using Service.Services;

namespace Api.Endpoints;

public static class AnnotationExportEndpoints
{
    public static RouteGroupBuilder
        MapAnnotationExportEndpoints(
            this IEndpointRouteBuilder routes)
    {
        var group = routes
            .MapGroup("/api/annotation-exports")
            .WithTags("Annotation Exports");

        group.MapGet(
            "/videos/{videoId:int}",
            ExportVideoAsync);

        group.MapGet(
            "/datasets/{datasetId:int}",
            ExportDatasetAsync);

        return group;
    }

    private static async Task<IResult> ExportVideoAsync(
        int videoId,
        string? format,
        bool? includeIncomplete,
        AnnotationExportService exportService,
        CancellationToken cancellationToken)
    {
        try
        {
            var file =
                await exportService.ExportVideoAsync(
                    videoId,
                    format ?? "json",
                    includeIncomplete ?? false,
                    cancellationToken);

            return file is null
                ? Results.NotFound(new
                {
                    message =
                        $"Video {videoId} does not exist."
                })
                : Results.File(
                    file.Content,
                    file.ContentType,
                    file.FileName);
        }
        catch (ArgumentException exception)
        {
            return Results.BadRequest(new
            {
                message = exception.Message
            });
        }
    }

    private static async Task<IResult> ExportDatasetAsync(
        int datasetId,
        string? format,
        bool? includeIncomplete,
        AnnotationExportService exportService,
        CancellationToken cancellationToken)
    {
        try
        {
            var file =
                await exportService.ExportDatasetAsync(
                    datasetId,
                    format ?? "json",
                    includeIncomplete ?? false,
                    cancellationToken);

            return file is null
                ? Results.NotFound(new
                {
                    message =
                        $"Dataset {datasetId} does not exist."
                })
                : Results.File(
                    file.Content,
                    file.ContentType,
                    file.FileName);
        }
        catch (ArgumentException exception)
        {
            return Results.BadRequest(new
            {
                message = exception.Message
            });
        }
    }
}