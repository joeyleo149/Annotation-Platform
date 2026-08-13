using System.Diagnostics;
using System.Text.Json;
using System.Text.Json.Serialization;
using Context;
using Context.Entities;
using Microsoft.EntityFrameworkCore;

namespace Service.Services;

public sealed class VideoUploadService(AppDbContext context)
{
    private static readonly Dictionary<string, string[]> AllowedMimeTypes =
        new(StringComparer.OrdinalIgnoreCase)
        {
            [".mp4"] = ["video/mp4", "application/octet-stream"],
            [".avi"] =
            [
                "video/x-msvideo",
                "video/avi",
                "application/octet-stream"
            ],
            [".mkv"] =
            [
                "video/x-matroska",
                "application/octet-stream"
            ]
        };

    public async Task<VideoUploadResult> UploadAsync(
        VideoUploadCommand command,
        CancellationToken cancellationToken = default)
    {
        ValidateCommand(command);

        var safeFileName = Path.GetFileName(
            command.OriginalFileName);

        var extension = Path.GetExtension(safeFileName);

        ValidateFileType(
            extension,
            command.ContentType);

        if (command.FileSizeBytes > command.MaximumFileSizeBytes)
        {
            throw new VideoUploadException(
                $"The video exceeds the maximum size of " +
                $"{command.MaximumFileSizeBytes / 1024 / 1024} MB.");
        }

        var adminExists = await context.Admins.AnyAsync(
            admin => admin.Id == command.UploadedByAdminId,
            cancellationToken);

        if (!adminExists)
        {
            throw new VideoUploadException(
                $"Admin {command.UploadedByAdminId} does not exist.");
        }

        var duplicateExists = await context.Videos.AnyAsync(
            video => video.FileName == safeFileName,
            cancellationToken);

        if (duplicateExists)
        {
            throw new VideoUploadConflictException(
                $"A video named '{safeFileName}' is already registered.");
        }

        var manifestMatch = await FindManifestScenarioAsync(
            command.ManifestPath,
            safeFileName,
            cancellationToken);

        Directory.CreateDirectory(command.VideoDirectory);
        Directory.CreateDirectory(command.ThumbnailDirectory);

        var finalVideoPath = Path.Combine(
            command.VideoDirectory,
            safeFileName);

        var temporaryVideoPath =
            finalVideoPath + "." + Guid.NewGuid() + ".uploading";

        var thumbnailFileName =
            Path.GetFileNameWithoutExtension(safeFileName) + ".jpg";

        var thumbnailPath = Path.Combine(
            command.ThumbnailDirectory,
            thumbnailFileName);

        try
        {
            await SaveUploadedFileAsync(
                command.Content,
                temporaryVideoPath,
                cancellationToken);

            if (File.Exists(finalVideoPath))
            {
                throw new VideoUploadConflictException(
                    $"A stored video named '{safeFileName}' already exists.");
            }

            File.Move(
                temporaryVideoPath,
                finalVideoPath);

            var processingResult = await ProcessVideoAsync(
                command.PythonExecutable,
                command.ProcessingScriptPath,
                finalVideoPath,
                thumbnailPath,
                cancellationToken);

            var status =
                manifestMatch.HasCompleteFutureTrajectory
                    ? "Ready"
                    : "IncompleteTrajectory";

            var video = new Video
            {
                ScenarioId = manifestMatch.ScenarioId,
                DatasetRowIndex = manifestMatch.DatasetRowIndex,
                FileName = safeFileName,
                StoragePath = finalVideoPath,
                MimeType = NormalizeMimeType(extension),
                FileSizeBytes = command.FileSizeBytes,
                DurationSeconds =
                    processingResult.DurationSeconds,
                FrameRate = processingResult.FrameRate,
                Width = processingResult.Width,
                Height = processingResult.Height,
                ThumbnailPath = thumbnailPath,
                ProcessingStatus = status,
                ProcessingError = null,
                ManifestMatched = true,
                ScenarioType = manifestMatch.ScenarioType,
                DrivingInstruction =
                    manifestMatch.DrivingInstruction,
                TrajectoryJson = manifestMatch.TrajectoryJson,
                ActionsJson = manifestMatch.ActionsJson,
                OriginalReasoningJson =
                    manifestMatch.OriginalReasoningJson,
                UploadedByAdminId = command.UploadedByAdminId,
                UploadedAt = DateTimeOffset.UtcNow
            };

            context.Videos.Add(video);
            await context.SaveChangesAsync(cancellationToken);

            return new VideoUploadResult(
                VideoId: video.Id,
                FileName: video.FileName,
                ScenarioId: video.ScenarioId,
                DatasetRowIndex: video.DatasetRowIndex,
                DurationSeconds: video.DurationSeconds,
                FrameRate: video.FrameRate,
                Width: video.Width,
                Height: video.Height,
                ThumbnailFileName: thumbnailFileName,
                ProcessingStatus: video.ProcessingStatus,
                ManifestMatched: video.ManifestMatched);
        }
        catch
        {
            DeleteIfExists(temporaryVideoPath);

            if (!await IsVideoRegisteredAsync(
                    safeFileName,
                    cancellationToken))
            {
                DeleteIfExists(finalVideoPath);
                DeleteIfExists(thumbnailPath);
            }

            throw;
        }
    }

    private static void ValidateCommand(
        VideoUploadCommand command)
    {
        ArgumentNullException.ThrowIfNull(command);
        ArgumentNullException.ThrowIfNull(command.Content);

        if (string.IsNullOrWhiteSpace(command.OriginalFileName))
        {
            throw new VideoUploadException(
                "The uploaded video must have a filename.");
        }

        if (!string.Equals(
                command.OriginalFileName,
                Path.GetFileName(command.OriginalFileName),
                StringComparison.Ordinal))
        {
            throw new VideoUploadException(
                "The uploaded filename must not contain a path.");
        }

        if (command.FileSizeBytes <= 0)
        {
            throw new VideoUploadException(
                "The uploaded video is empty.");
        }

        if (command.UploadedByAdminId <= 0)
        {
            throw new VideoUploadException(
                "A valid administrator ID is required.");
        }

        if (!File.Exists(command.ManifestPath))
        {
            throw new VideoUploadException(
                "Upload a valid trajectory manifest before uploading videos.");
        }

        if (!File.Exists(command.ProcessingScriptPath))
        {
            throw new VideoUploadException(
                "The video-processing script could not be found.");
        }
    }

    private static void ValidateFileType(
        string extension,
        string contentType)
    {
        if (!AllowedMimeTypes.TryGetValue(
                extension,
                out var acceptedMimeTypes))
        {
            throw new VideoUploadException(
                "Only .mp4, .avi, and .mkv videos are accepted.");
        }

        if (string.IsNullOrWhiteSpace(contentType))
        {
            return;
        }

        if (!acceptedMimeTypes.Contains(
                contentType,
                StringComparer.OrdinalIgnoreCase))
        {
            throw new VideoUploadException(
                $"Content type '{contentType}' does not match " +
                $"the '{extension}' extension.");
        }
    }

    private static string NormalizeMimeType(
        string extension)
    {
        return extension.ToLowerInvariant() switch
        {
            ".mp4" => "video/mp4",
            ".avi" => "video/x-msvideo",
            ".mkv" => "video/x-matroska",
            _ => "application/octet-stream"
        };
    }

    private static async Task SaveUploadedFileAsync(
        Stream content,
        string temporaryPath,
        CancellationToken cancellationToken)
    {
        await using var destination = new FileStream(
            temporaryPath,
            FileMode.CreateNew,
            FileAccess.Write,
            FileShare.None,
            bufferSize: 81920,
            useAsync: true);

        await content.CopyToAsync(
            destination,
            cancellationToken);
    }

    private static async Task<ManifestScenarioMatch>
        FindManifestScenarioAsync(
            string manifestPath,
            string videoFileName,
            CancellationToken cancellationToken)
    {
        await using var manifestStream = new FileStream(
            manifestPath,
            FileMode.Open,
            FileAccess.Read,
            FileShare.Read,
            bufferSize: 81920,
            useAsync: true);

        using var document = await JsonDocument.ParseAsync(
            manifestStream,
            cancellationToken: cancellationToken);

        if (!document.RootElement.TryGetProperty(
                "scenarios",
                out var scenarios) ||
            scenarios.ValueKind != JsonValueKind.Array)
        {
            throw new VideoUploadException(
                "The stored manifest does not contain a scenarios array.");
        }

        foreach (var scenario in scenarios.EnumerateArray())
        {
            if (!scenario.TryGetProperty(
                    "video",
                    out var videoMetadata) ||
                videoMetadata.ValueKind != JsonValueKind.Object ||
                !videoMetadata.TryGetProperty(
                    "filename",
                    out var filenameProperty))
            {
                continue;
            }

            var manifestFileName =
                filenameProperty.GetString();

            if (!string.Equals(
                    manifestFileName,
                    videoFileName,
                    StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            return CreateManifestMatch(
                scenario,
                videoFileName);
        }

        throw new VideoUploadException(
            $"No manifest scenario matches video " +
            $"'{videoFileName}'.");
    }

    private static ManifestScenarioMatch CreateManifestMatch(
        JsonElement scenario,
        string videoFileName)
    {
        var scenarioId = scenario
            .GetProperty("scenario_id")
            .GetString();

        var datasetRowIndex = scenario
            .GetProperty("dataset")
            .GetProperty("row_index")
            .GetInt32();

        var scenarioType = scenario
            .GetProperty("scenario_type")
            .GetString();

        var drivingInstruction = scenario
            .GetProperty("driving_instruction")
            .GetString();

        var trajectory = scenario.GetProperty("trajectory");

        var futureWaypoints = trajectory
            .GetProperty("expert_future")
            .GetProperty("waypoints");

        var hasCompleteFutureTrajectory =
            futureWaypoints.ValueKind == JsonValueKind.Array &&
            futureWaypoints.GetArrayLength() == 25;

        return new ManifestScenarioMatch(
            ScenarioId: scenarioId,
            DatasetRowIndex: datasetRowIndex,
            VideoFileName: videoFileName,
            ScenarioType: scenarioType,
            DrivingInstruction: drivingInstruction,
            TrajectoryJson: trajectory.GetRawText(),
            ActionsJson:
                GetOptionalRawJson(scenario, "actions"),
            OriginalReasoningJson:
                GetOptionalRawJson(
                    scenario,
                    "original_reasoning"),
            HasCompleteFutureTrajectory:
                hasCompleteFutureTrajectory);
    }

    private static string? GetOptionalRawJson(
        JsonElement parent,
        string propertyName)
    {
        return parent.TryGetProperty(
                   propertyName,
                   out var property)
            ? property.GetRawText()
            : null;
    }

    private static async Task<VideoProcessingResult>
        ProcessVideoAsync(
            string pythonExecutable,
            string scriptPath,
            string videoPath,
            string thumbnailPath,
            CancellationToken cancellationToken)
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = pythonExecutable,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        startInfo.ArgumentList.Add(scriptPath);
        startInfo.ArgumentList.Add("--input");
        startInfo.ArgumentList.Add(videoPath);
        startInfo.ArgumentList.Add("--thumbnail");
        startInfo.ArgumentList.Add(thumbnailPath);

        using var process = new Process
        {
            StartInfo = startInfo
        };

        if (!process.Start())
        {
            throw new VideoUploadException(
                "The video-processing process could not start.");
        }

        var standardOutputTask =
            process.StandardOutput.ReadToEndAsync(
                cancellationToken);

        var standardErrorTask =
            process.StandardError.ReadToEndAsync(
                cancellationToken);

        await process.WaitForExitAsync(cancellationToken);

        var standardOutput = await standardOutputTask;
        var standardError = await standardErrorTask;

        if (process.ExitCode != 0)
        {
            throw new VideoUploadException(
                string.IsNullOrWhiteSpace(standardError)
                    ? "Video processing failed."
                    : standardError.Trim());
        }

        var processingResult =
            JsonSerializer.Deserialize<VideoProcessingResult>(
                standardOutput);

        if (processingResult is null ||
            !processingResult.Success)
        {
            throw new VideoUploadException(
                "The processing script returned an invalid result.");
        }

        return processingResult;
    }

    private async Task<bool> IsVideoRegisteredAsync(
        string fileName,
        CancellationToken cancellationToken)
    {
        return await context.Videos.AnyAsync(
            video => video.FileName == fileName,
            cancellationToken);
    }

    private static void DeleteIfExists(
        string path)
    {
        if (File.Exists(path))
        {
            File.Delete(path);
        }
    }
}

public sealed record VideoUploadCommand(
    Stream Content,
    string OriginalFileName,
    string ContentType,
    long FileSizeBytes,
    int UploadedByAdminId,
    long MaximumFileSizeBytes,
    string VideoDirectory,
    string ThumbnailDirectory,
    string ManifestPath,
    string ProcessingScriptPath,
    string PythonExecutable);

public sealed record VideoUploadResult(
    int VideoId,
    string FileName,
    string? ScenarioId,
    int? DatasetRowIndex,
    double? DurationSeconds,
    double? FrameRate,
    int? Width,
    int? Height,
    string ThumbnailFileName,
    string ProcessingStatus,
    bool ManifestMatched);

internal sealed record ManifestScenarioMatch(
    string? ScenarioId,
    int DatasetRowIndex,
    string VideoFileName,
    string? ScenarioType,
    string? DrivingInstruction,
    string TrajectoryJson,
    string? ActionsJson,
    string? OriginalReasoningJson,
    bool HasCompleteFutureTrajectory);

internal sealed record VideoProcessingResult(
    [property: JsonPropertyName("success")]
    bool Success,

    [property: JsonPropertyName("durationSeconds")]
    double DurationSeconds,

    [property: JsonPropertyName("frameRate")]
    double FrameRate,

    [property: JsonPropertyName("width")]
    int Width,

    [property: JsonPropertyName("height")]
    int Height,

    [property: JsonPropertyName("codec")]
    string? Codec);

public class VideoUploadException(string message)
    : Exception(message);

public sealed class VideoUploadConflictException(string message)
    : VideoUploadException(message);