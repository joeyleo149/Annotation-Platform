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
}