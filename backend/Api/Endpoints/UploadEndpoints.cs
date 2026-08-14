using System.Text.Json;
using Context;
using Context.Entities;
using Microsoft.EntityFrameworkCore;
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
    HttpRequest request,
    ManifestService manifestService,
    AppDbContext database,
    IConfiguration configuration,
    IWebHostEnvironment environment,
    CancellationToken cancellationToken)
{
    if (!request.HasFormContentType)
    {
        return Results.BadRequest(new
        {
            message = "The request must use multipart/form-data."
        });
    }

    var form = await request.ReadFormAsync(
        cancellationToken);

    var file = form.Files.GetFile("file");

    if (file is null || file.Length == 0)
    {
        return Results.BadRequest(new
        {
            message = "Select a non-empty JSON manifest."
        });
    }

    var datasetName =
        form["datasetName"].FirstOrDefault()?.Trim();

    var datasetType =
        form["datasetType"].FirstOrDefault()?.Trim();

    if (string.IsNullOrWhiteSpace(datasetName))
    {
        return Results.BadRequest(new
        {
            message = "The datasetName form value is required."
        });
    }

    if (string.IsNullOrWhiteSpace(datasetType))
    {
        return Results.BadRequest(new
        {
            message = "The datasetType form value is required."
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

    var maximumSizeBytes =
        maximumSizeMb * 1024L * 1024L;

    if (file.Length > maximumSizeBytes)
    {
        return Results.BadRequest(new
        {
            message =
                $"The manifest cannot exceed {maximumSizeMb} MB."
        });
    }

    var datasetAlreadyExists =
        await database.Datasets.AnyAsync(
            dataset => dataset.Name == datasetName,
            cancellationToken);

    if (datasetAlreadyExists)
    {
        return Results.Conflict(new
        {
            message =
                $"A dataset named '{datasetName}' already exists."
        });
    }

    var relativeManifestDirectory =
        configuration.GetValue<string>(
            "VideoStorage:ManifestDirectory")
        ?? "Storage/Manifests";

    var manifestRootDirectory = ResolveStoragePath(
        configuration,
        environment,
        "VideoStorage:ManifestDirectory",
        relativeManifestDirectory);

    var datasetFolderName =
        CreateDatasetFolderName(datasetName);

    var datasetManifestDirectory = Path.Combine(
        manifestRootDirectory,
        datasetFolderName);

    var storedFileName =
        Path.GetFileName(file.FileName);

    var destinationPath = Path.Combine(
        datasetManifestDirectory,
        storedFileName);

    try
    {
        await using var uploadedStream =
            file.OpenReadStream();

        var manifestResult =
            await manifestService.ValidateAndStoreAsync(
                uploadedStream,
                destinationPath,
                cancellationToken);

        var dataset = new Dataset
        {
            Name = datasetName,
            DatasetType = datasetType,
            ManifestFileName = storedFileName,
            ManifestPath = destinationPath,
            IsArchived = false,
            ArchivedAt = null,
            CreatedAt = DateTimeOffset.UtcNow
        };

        database.Datasets.Add(dataset);

        await database.SaveChangesAsync(
            cancellationToken);

        return Results.Ok(new
        {
            message =
                "Dataset manifest uploaded and validated successfully.",
            datasetId = dataset.Id,
            dataset = new
            {
                dataset.Id,
                dataset.Name,
                dataset.DatasetType,
                dataset.ManifestFileName,
                dataset.IsArchived,
                dataset.CreatedAt
            },
            manifest = manifestResult
        });
    }
    catch (JsonException exception)
    {
        DeleteDatasetDirectory(
            datasetManifestDirectory);

        return Results.BadRequest(new
        {
            message = "The uploaded file is not valid JSON.",
            error = exception.Message
        });
    }
    catch (InvalidDataException exception)
    {
        DeleteDatasetDirectory(
            datasetManifestDirectory);

        return Results.BadRequest(new
        {
            message =
                "The manifest structure or data is invalid.",
            error = exception.Message
        });
    }
    catch (DbUpdateException exception)
    {
        DeleteDatasetDirectory(
            datasetManifestDirectory);

        return Results.Problem(
            title: "Dataset creation failed.",
            detail:
                "The manifest was valid, but its dataset record could not be created. " +
                exception.GetBaseException().Message,
            statusCode:
                StatusCodes.Status500InternalServerError);
    }
    catch (IOException)
    {
        DeleteDatasetDirectory(
            datasetManifestDirectory);

        return Results.Problem(
            title: "Manifest storage failed.",
            detail:
                "The server could not store the uploaded manifest.",
            statusCode:
                StatusCodes.Status500InternalServerError);
    }
}
private static async Task<IResult> UploadVideosAsync(
    HttpRequest request,
    VideoUploadService videoUploadService,
    AppDbContext database,
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

    if (!form.TryGetValue(
        "datasetId",
        out var datasetIdValues) ||
    !int.TryParse(
        datasetIdValues.FirstOrDefault(),
        out var datasetId) ||
    datasetId <= 0)
{
    return Results.BadRequest(new
    {
        message = "A valid datasetId form value is required."
    });
}

var requiredAnnotationCount = 1;

if (form.TryGetValue(
        "requiredAnnotationCount",
        out var annotationCountValues) &&
    (!int.TryParse(
         annotationCountValues.FirstOrDefault(),
         out requiredAnnotationCount) ||
     requiredAnnotationCount <= 0))
{
    return Results.BadRequest(new
    {
        message =
            "requiredAnnotationCount must be a positive integer."
    });
}

var dataset = await database.Datasets
    .AsNoTracking()
    .SingleOrDefaultAsync(
        item => item.Id == datasetId,
        cancellationToken);

if (dataset is null)
{
    return Results.NotFound(new
    {
        message = $"Dataset {datasetId} does not exist."
    });
}

if (dataset.IsArchived)
{
    return Results.Conflict(new
    {
        message =
            $"Dataset '{dataset.Name}' is archived and cannot receive videos."
    });
}

if (string.IsNullOrWhiteSpace(dataset.ManifestPath) ||
    !File.Exists(dataset.ManifestPath))
{
    return Results.BadRequest(new
    {
        message =
            $"Dataset '{dataset.Name}' does not have an accessible manifest."
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

    var videoRootDirectory = ResolveStoragePath(
        configuration,
        environment,
        "VideoStorage:VideoDirectory",
        "Storage/Videos");

    var thumbnailRootDirectory = ResolveStoragePath(
        configuration,
        environment,
        "VideoStorage:ThumbnailDirectory",
        "Storage/Thumbnails");

    var videoDirectory = Path.Combine(
        videoRootDirectory,
        $"dataset-{dataset.Id}");

    var thumbnailDirectory = Path.Combine(
        thumbnailRootDirectory,
        $"dataset-{dataset.Id}");


    var manifestPath = dataset.ManifestPath;

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
                DatasetId: datasetId,
                RequiredAnnotationCount: requiredAnnotationCount,
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

private static string CreateDatasetFolderName(
    string datasetName)
{
    var safeCharacters = datasetName
        .Where(character =>
            char.IsLetterOrDigit(character))
        .ToArray();

    var safeName =
        new string(safeCharacters)
            .ToLowerInvariant();

    if (string.IsNullOrWhiteSpace(safeName))
    {
        safeName = "dataset";
    }

    var uniqueSuffix =
        Guid.NewGuid()
            .ToString("N")[..8];

    return $"{safeName}-{uniqueSuffix}";
}

private static void DeleteDatasetDirectory(
    string directoryPath)
{
    if (Directory.Exists(directoryPath))
    {
        Directory.Delete(
            directoryPath,
            recursive: true);
    }
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