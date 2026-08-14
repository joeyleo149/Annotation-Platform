using Context;
using Context.Entities;
using Microsoft.EntityFrameworkCore;

namespace Service.Services;

public sealed class ArchiveService(
    AppDbContext context)
{
    public async Task<IReadOnlyList<DatasetArchiveSummary>>
        GetDatasetsAsync(
            bool includeArchived,
            CancellationToken cancellationToken = default)
    {
        var query = context.Datasets
            .AsNoTracking()
            .AsQueryable();

        if (!includeArchived)
        {
            query = query.Where(
                dataset => !dataset.IsArchived);
        }

        return await query
            .OrderBy(dataset => dataset.Name)
            .Select(dataset =>
                new DatasetArchiveSummary(
                    dataset.Id,
                    dataset.Name,
                    dataset.DatasetType,
                    dataset.IsArchived,
                    dataset.ArchivedAt,
                    context.Videos.Count(
                        video =>
                            video.DatasetId == dataset.Id),
                    context.Videos.Count(
                        video =>
                            video.DatasetId == dataset.Id &&
                            context.AnnotationSessions.Count(
                                session =>
                                    session.VideoId ==
                                        video.Id &&
                                    session.Status ==
                                        AnnotationSessionStatus
                                            .Completed)
                            >= video.RequiredAnnotationCount),
                    context.Videos.Count(
                        video =>
                            video.DatasetId == dataset.Id &&
                            video.IsArchived),
                    dataset.CreatedAt))
            .ToListAsync(cancellationToken);
    }

    public async Task<VideoArchiveOutcome>
        ArchiveVideoAsync(
            int videoId,
            CancellationToken cancellationToken = default)
    {
        var video = await context.Videos
            .Include(item => item.Dataset)
            .SingleOrDefaultAsync(
                item => item.Id == videoId,
                cancellationToken);

        if (video is null)
        {
            return new VideoArchiveOutcome(
                false,
                false,
                $"Video {videoId} does not exist.",
                videoId,
                0,
                0,
                false);
        }

        var completedAnnotations =
            await context.AnnotationSessions.CountAsync(
                session =>
                    session.VideoId == video.Id &&
                    session.Status ==
                        AnnotationSessionStatus.Completed,
                cancellationToken);

        if (video.IsArchived)
        {
            return new VideoArchiveOutcome(
                true,
                true,
                "The video is already archived.",
                video.Id,
                completedAnnotations,
                video.RequiredAnnotationCount,
                video.Dataset?.IsArchived ?? false);
        }

        if (completedAnnotations <
            video.RequiredAnnotationCount)
        {
            return new VideoArchiveOutcome(
                true,
                false,
                "The video cannot be archived because " +
                "its annotation quota has not been met.",
                video.Id,
                completedAnnotations,
                video.RequiredAnnotationCount,
                video.Dataset?.IsArchived ?? false);
        }

        var now = DateTimeOffset.UtcNow;

        video.IsArchived = true;
        video.ArchivedAt = now;

        await CancelActiveSessionsAsync(
            [video.Id],
            now,
            cancellationToken);

        await context.SaveChangesAsync(
            cancellationToken);

        var datasetArchived = false;

        if (video.DatasetId.HasValue)
        {
            var datasetOutcome =
                await ArchiveDatasetIfCompleteAsync(
                    video.DatasetId.Value,
                    cancellationToken);

            datasetArchived =
                datasetOutcome.Archived;
        }

        return new VideoArchiveOutcome(
            true,
            true,
            "The video was archived successfully.",
            video.Id,
            completedAnnotations,
            video.RequiredAnnotationCount,
            datasetArchived);
    }

    public async Task<VideoArchiveOutcome>
        RestoreVideoAsync(
            int videoId,
            CancellationToken cancellationToken = default)
    {
        var video = await context.Videos
            .Include(item => item.Dataset)
            .SingleOrDefaultAsync(
                item => item.Id == videoId,
                cancellationToken);

        if (video is null)
        {
            return new VideoArchiveOutcome(
                false,
                false,
                $"Video {videoId} does not exist.",
                videoId,
                0,
                0,
                false);
        }

        if (video.Dataset?.IsArchived == true)
        {
            return new VideoArchiveOutcome(
                true,
                false,
                "Restore the parent dataset before " +
                "restoring this video.",
                video.Id,
                0,
                video.RequiredAnnotationCount,
                true);
        }

        video.IsArchived = false;
        video.ArchivedAt = null;

        await context.SaveChangesAsync(
            cancellationToken);

        var completedAnnotations =
            await context.AnnotationSessions.CountAsync(
                session =>
                    session.VideoId == video.Id &&
                    session.Status ==
                        AnnotationSessionStatus.Completed,
                cancellationToken);

        return new VideoArchiveOutcome(
            true,
            true,
            "The video was restored successfully.",
            video.Id,
            completedAnnotations,
            video.RequiredAnnotationCount,
            false);
    }

    public async Task<DatasetArchiveOutcome>
        ArchiveDatasetIfCompleteAsync(
            int datasetId,
            CancellationToken cancellationToken = default)
    {
        var dataset = await context.Datasets
            .SingleOrDefaultAsync(
                item => item.Id == datasetId,
                cancellationToken);

        if (dataset is null)
        {
            return new DatasetArchiveOutcome(
                false,
                false,
                $"Dataset {datasetId} does not exist.",
                datasetId,
                0,
                0);
        }

        var videos = await context.Videos
            .Where(video =>
                video.DatasetId == datasetId)
            .ToListAsync(cancellationToken);

        if (videos.Count == 0)
        {
            return new DatasetArchiveOutcome(
                true,
                false,
                "An empty dataset cannot be archived.",
                dataset.Id,
                0,
                0);
        }

        var completedVideoCount = 0;

        foreach (var video in videos)
        {
            var completedAnnotations =
                await context.AnnotationSessions.CountAsync(
                    session =>
                        session.VideoId == video.Id &&
                        session.Status ==
                            AnnotationSessionStatus.Completed,
                    cancellationToken);

            if (completedAnnotations >=
                video.RequiredAnnotationCount)
            {
                completedVideoCount++;
            }
        }

        if (completedVideoCount < videos.Count)
        {
            return new DatasetArchiveOutcome(
                true,
                false,
                "The dataset cannot be archived because " +
                "one or more videos have not met their quota.",
                dataset.Id,
                videos.Count,
                completedVideoCount);
        }

        var now = DateTimeOffset.UtcNow;

        dataset.IsArchived = true;
        dataset.ArchivedAt = now;

        foreach (var video in videos)
        {
            video.IsArchived = true;
            video.ArchivedAt = now;
        }

        await CancelActiveSessionsAsync(
            videos.Select(video => video.Id),
            now,
            cancellationToken);

        await context.SaveChangesAsync(
            cancellationToken);

        return new DatasetArchiveOutcome(
            true,
            true,
            "The dataset and all its videos were archived.",
            dataset.Id,
            videos.Count,
            completedVideoCount);
    }

    public async Task<DatasetArchiveOutcome>
        RestoreDatasetAsync(
            int datasetId,
            CancellationToken cancellationToken = default)
    {
        var dataset = await context.Datasets
            .Include(item => item.Videos)
            .SingleOrDefaultAsync(
                item => item.Id == datasetId,
                cancellationToken);

        if (dataset is null)
        {
            return new DatasetArchiveOutcome(
                false,
                false,
                $"Dataset {datasetId} does not exist.",
                datasetId,
                0,
                0);
        }

        dataset.IsArchived = false;
        dataset.ArchivedAt = null;

        foreach (var video in dataset.Videos)
        {
            video.IsArchived = false;
            video.ArchivedAt = null;
        }

        await context.SaveChangesAsync(
            cancellationToken);

        return new DatasetArchiveOutcome(
            true,
            false,
            "The dataset and its videos were restored.",
            dataset.Id,
            dataset.Videos.Count,
            0);
    }

    public async Task<AutomaticArchiveResult>
        ArchiveEligibleDatasetsAsync(
            CancellationToken cancellationToken = default)
    {
        var datasetIds = await context.Datasets
            .AsNoTracking()
            .Where(dataset =>
                !dataset.IsArchived &&
                context.Videos.Any(video =>
                    video.DatasetId == dataset.Id))
            .Select(dataset => dataset.Id)
            .ToListAsync(cancellationToken);

        var outcomes =
            new List<DatasetArchiveOutcome>();

        foreach (var datasetId in datasetIds)
        {
            var outcome =
                await ArchiveDatasetIfCompleteAsync(
                    datasetId,
                    cancellationToken);

            if (outcome.Archived)
            {
                outcomes.Add(outcome);
            }
        }

        return new AutomaticArchiveResult(
            DateTimeOffset.UtcNow,
            outcomes.Count,
            outcomes);
    }

    private async Task CancelActiveSessionsAsync(
        IEnumerable<int> videoIds,
        DateTimeOffset cancelledAt,
        CancellationToken cancellationToken)
    {
        var ids = videoIds.ToArray();

        var activeSessions =
            await context.AnnotationSessions
                .Where(session =>
                    ids.Contains(session.VideoId) &&
                    (session.Status ==
                        AnnotationSessionStatus.Assigned ||
                     session.Status ==
                        AnnotationSessionStatus.InProgress))
                .ToListAsync(cancellationToken);

        foreach (var session in activeSessions)
        {
            session.Status =
                AnnotationSessionStatus.Cancelled;

            session.CancelledAt =
                cancelledAt;
        }
    }
}

public sealed record DatasetArchiveSummary(
    int Id,
    string Name,
    string DatasetType,
    bool IsArchived,
    DateTimeOffset? ArchivedAt,
    int TotalVideos,
    int CompletedVideos,
    int ArchivedVideos,
    DateTimeOffset CreatedAt);

public sealed record VideoArchiveOutcome(
    bool Found,
    bool Archived,
    string Message,
    int VideoId,
    int CompletedAnnotationCount,
    int RequiredAnnotationCount,
    bool DatasetArchived);

public sealed record DatasetArchiveOutcome(
    bool Found,
    bool Archived,
    string Message,
    int DatasetId,
    int TotalVideoCount,
    int CompletedVideoCount);

public sealed record AutomaticArchiveResult(
    DateTimeOffset ProcessedAt,
    int ArchivedDatasetCount,
    IReadOnlyList<DatasetArchiveOutcome> Outcomes);