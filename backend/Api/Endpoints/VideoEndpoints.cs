using Service.Services;

namespace Api.Endpoints;

public static class VideoEndpoints
{
    public static RouteGroupBuilder MapVideoEndpoints(
        this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/videos").WithTags("Videos");

        group.MapGet("/", GetCatalogAsync);
        group.MapGet("/{id:int}", GetVideoAsync);
        group.MapGet(
        "/{id:int}/stream",
        StreamVideoAsync)
    .AllowAnonymous();

group.MapGet(
        "/{id:int}/thumbnail",
        GetThumbnailAsync)
    .AllowAnonymous();
        group.MapPatch("/{id:int}/quota", UpdateQuotaAsync);
        group.MapGet("/datasets/{datasetId:int}/metrics", GetDatasetMetricsAsync);
        group.MapPatch("/{id:int}/archive", ArchiveVideoAsync);
        group.MapPatch("/{id:int}/restore", RestoreVideoAsync);
        group.MapDelete("/{id:int}", DeleteVideoAsync);

        return group;
    }

    private static async Task<IResult> GetCatalogAsync(
        int? datasetId, bool? includeArchived,
        VideoService videoService, CancellationToken cancellationToken)
    {
        var videos = await videoService.GetCatalogAsync(
            datasetId, includeArchived ?? false, cancellationToken);
        return Results.Ok(videos);
    }

    private static async Task<IResult> GetVideoAsync(
        int id, VideoService videoService,
        CancellationToken cancellationToken)
    {
        var video = await videoService.GetCatalogItemAsync(
            id, cancellationToken);
        return video is null
            ? Results.NotFound(new { message = $"Video {id} does not exist." })
            : Results.Ok(video);
    }

    private static async Task<IResult> StreamVideoAsync(
        int id, VideoService videoService,
        CancellationToken cancellationToken)
    {
        var video = await videoService.GetStoredVideoAsync(
            id, cancellationToken);

        if (video is null)
        {
            return Results.NotFound(new
            {
                message = $"Video {id} does not exist."
            });
        }

        if (!File.Exists(video.StoragePath))
        {
            return Results.NotFound(new
            {
                message = "The video record exists, but its file is missing."
            });
        }

        return Results.File(
            video.StoragePath,
            video.MimeType,
            enableRangeProcessing: true);
    }

    private static async Task<IResult> GetThumbnailAsync(
        int id, VideoService videoService,
        CancellationToken cancellationToken)
    {
        var thumbnail = await videoService.GetStoredThumbnailAsync(
            id, cancellationToken);

        if (thumbnail is null || !File.Exists(thumbnail.ThumbnailPath))
        {
            return Results.NotFound(new
            {
                message = $"A thumbnail for video {id} was not found."
            });
        }

        return Results.File(thumbnail.ThumbnailPath, "image/jpeg");
    }

    private static async Task<IResult> UpdateQuotaAsync(
        int id, UpdateVideoQuotaRequest request,
        VideoService videoService, CancellationToken cancellationToken)
    {
        if (request.RequiredAnnotationCount <= 0)
        {
            return Results.BadRequest(new
            {
                message = "RequiredAnnotationCount must be positive."
            });
        }

        var video = await videoService.UpdateQuotaAsync(
            id, request.RequiredAnnotationCount, cancellationToken);

        return video is null
            ? Results.NotFound(new { message = $"Video {id} does not exist." })
            : Results.Ok(new
            {
                message = "The required annotation count was updated.",
                video
            });
    }

    private static async Task<IResult> GetDatasetMetricsAsync(
        int datasetId, VideoService videoService,
        CancellationToken cancellationToken)
    {
        var metrics = await videoService.GetDatasetMetricsAsync(
            datasetId, cancellationToken);
        return metrics is null
            ? Results.NotFound(new
            {
                message = $"Dataset {datasetId} does not exist."
            })
            : Results.Ok(metrics);
    }

    private static async Task<IResult> ArchiveVideoAsync(
        int id, ArchiveService archiveService,
        CancellationToken cancellationToken)
    {
        var outcome = await archiveService.ArchiveVideoAsync(
            id, cancellationToken);

        if (!outcome.Found) return Results.NotFound(outcome);
        if (!outcome.Archived) return Results.Conflict(outcome);
        return Results.Ok(outcome);
    }

    private static async Task<IResult> RestoreVideoAsync(
        int id, ArchiveService archiveService,
        CancellationToken cancellationToken)
    {
        var outcome = await archiveService.RestoreVideoAsync(
            id, cancellationToken);

        if (!outcome.Found) return Results.NotFound(outcome);
        if (outcome.DatasetArchived) return Results.Conflict(outcome);
        return Results.Ok(outcome);
    }

    private static async Task<IResult> DeleteVideoAsync(
        int id, VideoService videoService,
        CancellationToken cancellationToken)
    {
        var outcome = await videoService.DeletePermanentlyAsync(
            id, cancellationToken);

        return outcome.Found
            ? Results.Ok(outcome)
            : Results.NotFound(outcome);
    }
}

public sealed record UpdateVideoQuotaRequest(
    int RequiredAnnotationCount);