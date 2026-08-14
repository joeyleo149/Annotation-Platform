using Context;
using Context.Entities;
using Microsoft.EntityFrameworkCore;

namespace Service.Services;

public sealed class VideoService(AppDbContext context)
{
    public async Task<IReadOnlyList<VideoCatalogItem>>
        GetCatalogAsync(
            int? datasetId,
            bool includeArchived,
            CancellationToken cancellationToken = default)
    {
        var query = context.Videos
            .AsNoTracking()
            .AsQueryable();

        if (datasetId.HasValue)
        {
            query = query.Where(
                video => video.DatasetId == datasetId.Value);
        }

        if (!includeArchived)
        {
            query = query.Where(
                video => !video.IsArchived);
        }

        return await query
            .OrderBy(video => video.DatasetRowIndex)
            .ThenBy(video => video.Id)
            .Select(video => new VideoCatalogItem(
                video.Id,
                video.DatasetId,
                video.Dataset != null
                    ? video.Dataset.Name
                    : null,
                video.ScenarioId,
                video.DatasetRowIndex,
                video.FileName,
                video.MimeType,
                video.FileSizeBytes,
                video.DurationSeconds,
                video.FrameRate,
                video.Width,
                video.Height,
                video.ProcessingStatus,
                video.ManifestMatched,
                video.ScenarioType,
                video.DrivingInstruction,
                video.RequiredAnnotationCount,
                context.AnnotationSessions.Count(
                    session =>
                        session.VideoId == video.Id &&
                        session.Status ==
                            AnnotationSessionStatus.Completed),
                Math.Max(
                    0,
                    video.RequiredAnnotationCount -
                    context.AnnotationSessions.Count(
                        session =>
                            session.VideoId == video.Id &&
                            session.Status ==
                                AnnotationSessionStatus.Completed)),
                context.AnnotationSessions.Count(
                    session =>
                        session.VideoId == video.Id &&
                        session.Status ==
                            AnnotationSessionStatus.Completed)
                    >= video.RequiredAnnotationCount,
                video.IsArchived,
                video.ArchivedAt,
                video.UploadedAt,
                $"/api/videos/{video.Id}/stream",
                video.ThumbnailPath != null
                    ? $"/api/videos/{video.Id}/thumbnail"
                    : null))
            .ToListAsync(cancellationToken);
    }

    public async Task<VideoCatalogItem?> GetCatalogItemAsync(
        int videoId,
        CancellationToken cancellationToken = default)
    {
        return await context.Videos
            .AsNoTracking()
            .Where(video => video.Id == videoId)
            .Select(video => new VideoCatalogItem(
                video.Id,
                video.DatasetId,
                video.Dataset != null
                    ? video.Dataset.Name
                    : null,
                video.ScenarioId,
                video.DatasetRowIndex,
                video.FileName,
                video.MimeType,
                video.FileSizeBytes,
                video.DurationSeconds,
                video.FrameRate,
                video.Width,
                video.Height,
                video.ProcessingStatus,
                video.ManifestMatched,
                video.ScenarioType,
                video.DrivingInstruction,
                video.RequiredAnnotationCount,
                context.AnnotationSessions.Count(
                    session =>
                        session.VideoId == video.Id &&
                        session.Status ==
                            AnnotationSessionStatus.Completed),
                Math.Max(
                    0,
                    video.RequiredAnnotationCount -
                    context.AnnotationSessions.Count(
                        session =>
                            session.VideoId == video.Id &&
                            session.Status ==
                                AnnotationSessionStatus.Completed)),
                context.AnnotationSessions.Count(
                    session =>
                        session.VideoId == video.Id &&
                        session.Status ==
                            AnnotationSessionStatus.Completed)
                    >= video.RequiredAnnotationCount,
                video.IsArchived,
                video.ArchivedAt,
                video.UploadedAt,
                $"/api/videos/{video.Id}/stream",
                video.ThumbnailPath != null
                    ? $"/api/videos/{video.Id}/thumbnail"
                    : null))
            .SingleOrDefaultAsync(cancellationToken);
    }

    public async Task<StoredVideoFile?> GetStoredVideoAsync(
        int videoId,
        CancellationToken cancellationToken = default)
    {
        return await context.Videos
            .AsNoTracking()
            .Where(video => video.Id == videoId)
            .Select(video => new StoredVideoFile(
                video.FileName,
                video.StoragePath,
                video.MimeType))
            .SingleOrDefaultAsync(cancellationToken);
    }

    public async Task<StoredThumbnailFile?>
        GetStoredThumbnailAsync(
            int videoId,
            CancellationToken cancellationToken = default)
    {
        return await context.Videos
            .AsNoTracking()
            .Where(video =>
                video.Id == videoId &&
                video.ThumbnailPath != null)
            .Select(video => new StoredThumbnailFile(
                video.FileName,
                video.ThumbnailPath!))
            .SingleOrDefaultAsync(cancellationToken);
    }

    public async Task<VideoCatalogItem?> UpdateQuotaAsync(
        int videoId,
        int requiredAnnotationCount,
        CancellationToken cancellationToken = default)
    {
        if (requiredAnnotationCount <= 0)
        {
            throw new ArgumentOutOfRangeException(
                nameof(requiredAnnotationCount));
        }

        var video = await context.Videos
            .SingleOrDefaultAsync(
                item => item.Id == videoId,
                cancellationToken);

        if (video is null)
        {
            return null;
        }

        video.RequiredAnnotationCount =
            requiredAnnotationCount;

        await context.SaveChangesAsync(
            cancellationToken);

        return await GetCatalogItemAsync(
            videoId,
            cancellationToken);
    }

    public async Task<DatasetMetrics?> GetDatasetMetricsAsync(
        int datasetId,
        CancellationToken cancellationToken = default)
    {
        var dataset = await context.Datasets
            .AsNoTracking()
            .SingleOrDefaultAsync(
                item => item.Id == datasetId,
                cancellationToken);

        if (dataset is null)
        {
            return null;
        }

        var videos = context.Videos
            .AsNoTracking()
            .Where(video => video.DatasetId == datasetId);

        var totalVideos = await videos.CountAsync(
            cancellationToken);

        var archivedVideos = await videos.CountAsync(
            video => video.IsArchived,
            cancellationToken);

        var totalRequiredAnnotations = await videos.SumAsync(
            video => (int?)video.RequiredAnnotationCount,
            cancellationToken) ?? 0;

        var completedAnnotations =
            await context.AnnotationSessions.CountAsync(
                session =>
                    session.Video.DatasetId == datasetId &&
                    session.Status ==
                        AnnotationSessionStatus.Completed,
                cancellationToken);

        var completedVideos = await videos.CountAsync(
            video =>
                context.AnnotationSessions.Count(
                    session =>
                        session.VideoId == video.Id &&
                        session.Status ==
                            AnnotationSessionStatus.Completed)
                >= video.RequiredAnnotationCount,
            cancellationToken);

        var totalDurationSeconds = await videos.SumAsync(
            video => video.DurationSeconds ?? 0,
            cancellationToken);

        var annotatedSeconds =
            await context.AnnotationSessions
                .Where(session =>
                    session.Video.DatasetId == datasetId &&
                    session.Status ==
                        AnnotationSessionStatus.Completed)
                .SumAsync(
                    session =>
                        session.Video.DurationSeconds ?? 0,
                    cancellationToken);

        return new DatasetMetrics(
            dataset.Id,
            dataset.Name,
            dataset.DatasetType,
            dataset.IsArchived,
            totalVideos,
            archivedVideos,
            completedVideos,
            totalVideos - completedVideos,
            totalRequiredAnnotations,
            completedAnnotations,
            Math.Max(
                0,
                totalRequiredAnnotations -
                completedAnnotations),
            totalDurationSeconds,
            annotatedSeconds / 3600);
    }

    public async Task<VideoDeletionOutcome> DeletePermanentlyAsync(
        int videoId,
        CancellationToken cancellationToken = default)
    {
        var video = await context.Videos
            .AsNoTracking()
            .Where(item => item.Id == videoId)
            .Select(item => new
            {
                item.Id,
                item.FileName,
                item.StoragePath,
                item.ThumbnailPath
            })
            .SingleOrDefaultAsync(cancellationToken);

        if (video is null)
        {
            return new VideoDeletionOutcome(
                false, false,
                $"Video {videoId} does not exist.",
                videoId, 0, 0, 0, 0, false, false);
        }

        var sessionIds = await context.AnnotationSessions
            .Where(session => session.VideoId == videoId)
            .Select(session => session.Id)
            .ToListAsync(cancellationToken);

        var segmentIds = sessionIds.Count == 0
            ? []
            : await context.SegmentResponses
                .Where(response =>
                    sessionIds.Contains(response.AnnotationSessionId))
                .Select(response => response.Id)
                .ToListAsync(cancellationToken);

        await using var transaction =
            await context.Database.BeginTransactionAsync(
                cancellationToken);

        var deletedQuestionAnswers = segmentIds.Count == 0
            ? 0
            : await context.QuestionAnswers
                .Where(answer =>
                    segmentIds.Contains(answer.SegmentResponseId))
                .ExecuteDeleteAsync(cancellationToken);

        var deletedSegmentResponses = sessionIds.Count == 0
            ? 0
            : await context.SegmentResponses
                .Where(response =>
                    sessionIds.Contains(response.AnnotationSessionId))
                .ExecuteDeleteAsync(cancellationToken);

        var deletedTaskRequests = sessionIds.Count == 0
            ? 0
            : await context.AnnotationTaskRequests
                .Where(request =>
                    request.AnnotationSessionId.HasValue &&
                    sessionIds.Contains(
                        request.AnnotationSessionId.Value))
                .ExecuteDeleteAsync(cancellationToken);

        var deletedSessions = await context.AnnotationSessions
            .Where(session => session.VideoId == videoId)
            .ExecuteDeleteAsync(cancellationToken);

        await context.Videos
            .Where(item => item.Id == videoId)
            .ExecuteDeleteAsync(cancellationToken);

        await transaction.CommitAsync(cancellationToken);

        var videoFileDeleted = TryDeleteFile(video.StoragePath);
        var thumbnailDeleted = TryDeleteFile(video.ThumbnailPath);
        var filesDeleted = videoFileDeleted && thumbnailDeleted;

        return new VideoDeletionOutcome(
            true,
            true,
            filesDeleted
                ? $"{video.FileName} and all related data were permanently deleted."
                : $"{video.FileName} was removed from the database, but one or more stored files could not be deleted.",
            videoId,
            deletedSessions,
            deletedSegmentResponses,
            deletedQuestionAnswers,
            deletedTaskRequests,
            videoFileDeleted,
            thumbnailDeleted);
    }

    private static bool TryDeleteFile(string? path)
    {
        if (string.IsNullOrWhiteSpace(path) || !File.Exists(path))
        {
            return true;
        }

        try
        {
            File.Delete(path);
            return true;
        }
        catch (IOException)
        {
            return false;
        }
        catch (UnauthorizedAccessException)
        {
            return false;
        }
    }
}

public sealed record VideoCatalogItem(
    int Id,
    int? DatasetId,
    string? DatasetName,
    string? ScenarioId,
    int? DatasetRowIndex,
    string FileName,
    string MimeType,
    long FileSizeBytes,
    double? DurationSeconds,
    double? FrameRate,
    int? Width,
    int? Height,
    string ProcessingStatus,
    bool ManifestMatched,
    string? ScenarioType,
    string? DrivingInstruction,
    int RequiredAnnotationCount,
    int CompletedAnnotationCount,
    int RemainingAnnotationCount,
    bool IsQuotaMet,
    bool IsArchived,
    DateTimeOffset? ArchivedAt,
    DateTimeOffset UploadedAt,
    string StreamUrl,
    string? ThumbnailUrl);

public sealed record StoredVideoFile(
    string FileName,
    string StoragePath,
    string MimeType);

public sealed record StoredThumbnailFile(
    string VideoFileName,
    string ThumbnailPath);

public sealed record DatasetMetrics(
    int DatasetId,
    string DatasetName,
    string DatasetType,
    bool IsArchived,
    int TotalVideos,
    int ArchivedVideos,
    int CompletedVideos,
    int PendingVideos,
    int TotalRequiredAnnotations,
    int CompletedAnnotations,
    int RemainingAnnotations,
    double TotalDurationSeconds,
    double TotalHoursAnnotated);

public sealed record VideoDeletionOutcome(
    bool Found,
    bool Deleted,
    string Message,
    int VideoId,
    int DeletedSessionCount,
    int DeletedSegmentResponseCount,
    int DeletedQuestionAnswerCount,
    int DeletedTaskRequestCount,
    bool VideoFileDeleted,
    bool ThumbnailDeleted);