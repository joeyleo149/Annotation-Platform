using System.Text.Json;
using Service.Services;

namespace Api.Endpoints;

public static class UploadEndpoints
{
    public static RouteGroupBuilder MapUploadEndpoints(
        this IEndpointRouteBuilder routes)
    {
        var group = routes
            .MapGroup("/api/upload")
            .WithTags("Upload");

        group.MapPost(
                "/manifest",
                UploadManifestAsync)
            .DisableAntiforgery();
        group.MapPost(
                "/videos",
            UploadVideosAsync)
             .DisableAntiforgery();

        return group;
    }

    private static async Task<IResult> UploadManifestAsync(
        IFormFile file,
        ManifestService manifestService,
        IConfiguration configuration,
        IWebHostEnvironment environment,
        CancellationToken cancellationToken)
    {
        if (file.Length == 0)
        {
            return Results.BadRequest(new
            {
                message = "Select a non-empty JSON manifest."
            });
        }

        if (!string.Equals(
                Path.GetExtension(file.FileName),
                ".json",
                StringComparison.OrdinalIgnoreCase))
        {
            return Results.BadRequest(new
            {
                message = "Only .json manifest files are accepted."
            });
        }

        var maximumSizeMb = configuration.GetValue<int>(
            "VideoStorage:MaximumManifestFileSizeMb",
            20);

        var maximumSizeBytes = maximumSizeMb * 1024L * 1024L;

        if (file.Length > maximumSizeBytes)
        {
            return Results.BadRequest(new
            {
                message =
                    $"The manifest cannot exceed {maximumSizeMb} MB."
            });
        }

        var relativeDirectory = configuration.GetValue<string>(
            "VideoStorage:ManifestDirectory")
            ?? "Storage/Manifests";

        var storedFileName = configuration.GetValue<string>(
            "VideoStorage:ManifestFileName")
            ?? "train_scenario_manifest.json";

        var manifestDirectory = Path.Combine(
            environment.ContentRootPath,
            relativeDirectory);

        var destinationPath = Path.Combine(
            manifestDirectory,
            Path.GetFileName(storedFileName));

        try
        {
            await using var uploadedStream = file.OpenReadStream();

            var result =
                await manifestService.ValidateAndStoreAsync(
                    uploadedStream,
                    destinationPath,
                    cancellationToken);

            return Results.Ok(new
            {
                message =
                    "Manifest uploaded and validated successfully.",
                manifest = result
            });
        }
        catch (JsonException exception)
        {
            return Results.BadRequest(new
            {
                message = "The uploaded file is not valid JSON.",
                error = exception.Message
            });
        }
        catch (InvalidDataException exception)
        {
            return Results.BadRequest(new
            {
                message =
                    "The manifest structure or data is invalid.",
                error = exception.Message
            });
        }
        catch (IOException)
        {
            return Results.Problem(
                title: "Manifest storage failed.",
                detail:
                    "The server could not store the uploaded manifest.",
                statusCode: StatusCodes.Status500InternalServerError);
        }
    }
private static async Task<IResult> UploadVideosAsync(
    HttpRequest request,
    VideoUploadService videoUploadService,
    IConfiguration configuration,
    IWebHostEnvironment environment,
    CancellationToken cancellationToken)
{
    if (!request.HasFormContentType)
    {
        return Results.BadRequest(new
        {
            message =
                "The request must use multipart/form-data."
        });
    }

    var form = await request.ReadFormAsync(
        cancellationToken);

    if (!form.TryGetValue(
            "uploadedByAdminId",
            out var adminIdValues) ||
        !int.TryParse(
            adminIdValues.FirstOrDefault(),
            out var uploadedByAdminId) ||
        uploadedByAdminId <= 0)
    {
        return Results.BadRequest(new
        {
            message =
                "A valid uploadedByAdminId form value is required."
        });
    }

    if (form.Files.Count == 0)
    {
        return Results.BadRequest(new
        {
            message = "Select at least one video."
        });
    }

    var maximumSizeMb = configuration.GetValue<long>(
        "VideoStorage:MaximumFileSizeMb",
        500);

    var maximumSizeBytes =
        maximumSizeMb * 1024L * 1024L;

    var videoDirectory = ResolveStoragePath(
        configuration,
        environment,
        "VideoStorage:VideoDirectory",
        "Storage/Videos");

    var thumbnailDirectory = ResolveStoragePath(
        configuration,
        environment,
        "VideoStorage:ThumbnailDirectory",
        "Storage/Thumbnails");

    var manifestDirectory = ResolveStoragePath(
        configuration,
        environment,
        "VideoStorage:ManifestDirectory",
        "Storage/Manifests");

    var manifestFileName = configuration.GetValue<string>(
        "VideoStorage:ManifestFileName")
        ?? "train_scenario_manifest.json";

    var manifestPath = Path.Combine(
        manifestDirectory,
        Path.GetFileName(manifestFileName));

    var processingScriptPath = Path.GetFullPath(
        Path.Combine(
            environment.ContentRootPath,
            "..",
            "Scripts",
            "video_processing.py"));

    var pythonExecutable = configuration.GetValue<string>(
        "VideoProcessing:PythonExecutable")
        ?? "python";

    var successfulUploads =
        new List<VideoUploadResult>();

    var failedUploads =
        new List<VideoUploadFailure>();

    foreach (var file in form.Files)
    {
        try
        {
            await using var content =
                file.OpenReadStream();

            var command = new VideoUploadCommand(
                Content: content,
                OriginalFileName: file.FileName,
                ContentType: file.ContentType,
                FileSizeBytes: file.Length,
                UploadedByAdminId: uploadedByAdminId,
                MaximumFileSizeBytes: maximumSizeBytes,
                VideoDirectory: videoDirectory,
                ThumbnailDirectory: thumbnailDirectory,
                ManifestPath: manifestPath,
                ProcessingScriptPath: processingScriptPath,
                PythonExecutable: pythonExecutable);

            var result =
                await videoUploadService.UploadAsync(
                    command,
                    cancellationToken);

            successfulUploads.Add(result);
        }
        catch (VideoUploadConflictException exception)
        {
            failedUploads.Add(new VideoUploadFailure(
                FileName: file.FileName,
                StatusCode:
                    StatusCodes.Status409Conflict,
                Error: exception.Message));
        }
        catch (VideoUploadException exception)
        {
            failedUploads.Add(new VideoUploadFailure(
                FileName: file.FileName,
                StatusCode:
                    StatusCodes.Status400BadRequest,
                Error: exception.Message));
        }
        catch (JsonException exception)
        {
            failedUploads.Add(new VideoUploadFailure(
                FileName: file.FileName,
                StatusCode:
                    StatusCodes.Status400BadRequest,
                Error:
                    "The stored manifest could not be read: " +
                    exception.Message));
        }
        catch (IOException)
        {
            failedUploads.Add(new VideoUploadFailure(
                FileName: file.FileName,
                StatusCode:
                    StatusCodes.Status500InternalServerError,
                Error:
                    "The server could not store or process " +
                    "the uploaded file."));
        }
    }

    var response = new VideoUploadBatchResponse(
        RequestedCount: form.Files.Count,
        SuccessfulCount: successfulUploads.Count,
        FailedCount: failedUploads.Count,
        SuccessfulUploads: successfulUploads,
        FailedUploads: failedUploads);

    if (successfulUploads.Count == 0)
    {
        return Results.BadRequest(response);
    }

    return Results.Ok(response);
}
private static string ResolveStoragePath(
    IConfiguration configuration,
    IWebHostEnvironment environment,
    string configurationKey,
    string fallbackRelativePath)
{
    var configuredPath =
        configuration.GetValue<string>(
            configurationKey)
        ?? fallbackRelativePath;

    return Path.IsPathRooted(configuredPath)
        ? configuredPath
        : Path.GetFullPath(
            Path.Combine(
                environment.ContentRootPath,
                configuredPath));
}    
}
public sealed record VideoUploadFailure(
    string FileName,
    int StatusCode,
    string Error);

public sealed record VideoUploadBatchResponse(
    int RequestedCount,
    int SuccessfulCount,
    int FailedCount,
    IReadOnlyList<VideoUploadResult> SuccessfulUploads,
    IReadOnlyList<VideoUploadFailure> FailedUploads);