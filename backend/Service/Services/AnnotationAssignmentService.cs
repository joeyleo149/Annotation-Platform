using System.Data;
using Context;
using Context.Entities;
using Microsoft.EntityFrameworkCore;

namespace Service.Services;

public sealed class AnnotationAssignmentService(
    AppDbContext context)
{
    public async Task<AutomaticTaskRequestResult>
        CreateAndAssignRequestAsync(
            int annotatorId,
            int datasetId,
            int assignmentDurationDays,
            CancellationToken cancellationToken = default)
    {
        var request = await CreateRequestAsync(
            annotatorId,
            datasetId,
            cancellationToken);

        var assignments =
            await AssignAvailableRequestsForDatasetAsync(
            datasetId,
            assignmentDurationDays,
            cancellationToken);

        var assignment = assignments
            .FirstOrDefault(outcome =>
                outcome.RequestId == request.Id)
            ?? new AssignmentOutcome(
                false,
                "No eligible video is currently available. " +
                "The request remains waiting.",
                request.Id,
                request.AnnotatorId,
                null,
                null,
                null);

        return new AutomaticTaskRequestResult(
            request,
            assignment);
    }

    public async Task<IReadOnlyList<AssignmentOutcome>>
        AssignAvailableRequestsForDatasetAsync(
            int datasetId,
            int assignmentDurationDays,
            CancellationToken cancellationToken = default)
    {
        var assignments = new List<AssignmentOutcome>();

        while (true)
        {
            var outcome = await AssignNextAsync(
                datasetId,
                assignmentDurationDays,
                cancellationToken);

            if (!outcome.Assigned)
            {
                break;
            }

            assignments.Add(outcome);
        }

        return assignments;
    }

    public async Task<WaitingRequestProcessingResult>
        ProcessWaitingRequestsAsync(
            int assignmentDurationDays,
            CancellationToken cancellationToken = default)
    {
        var datasetIds = await context.AnnotationTaskRequests
            .AsNoTracking()
            .Where(request =>
                request.Status ==
                    AnnotationTaskRequestStatus.Waiting)
            .Select(request => request.DatasetId)
            .Distinct()
            .ToListAsync(cancellationToken);

        var assignments = new List<AssignmentOutcome>();

        foreach (var datasetId in datasetIds)
        {
            assignments.AddRange(
                await AssignAvailableRequestsForDatasetAsync(
                    datasetId,
                    assignmentDurationDays,
                    cancellationToken));
        }

        return new WaitingRequestProcessingResult(
            assignments.Count,
            DateTimeOffset.UtcNow,
            assignments);
    }

    public async Task<TaskRequestResult>
        CreateRequestAsync(
            int annotatorId,
            int datasetId,
            CancellationToken cancellationToken = default)
    {
        if (annotatorId <= 0 || datasetId <= 0)
        {
            throw new ArgumentException(
                "Valid annotator and dataset IDs are required.");
        }

        var annotatorExists =
            await context.Annotators.AnyAsync(
                annotator => annotator.Id == annotatorId,
                cancellationToken);

        if (!annotatorExists)
        {
            throw new KeyNotFoundException(
                $"Annotator {annotatorId} does not exist.");
        }

        var dataset = await context.Datasets
            .AsNoTracking()
            .SingleOrDefaultAsync(
                item => item.Id == datasetId,
                cancellationToken);

        if (dataset is null)
        {
            throw new KeyNotFoundException(
                $"Dataset {datasetId} does not exist.");
        }

        if (dataset.IsArchived)
        {
            throw new TaskRequestConflictException(
                $"Dataset '{dataset.Name}' is archived.");
        }

        var hasActiveAssignment = await context.AnnotationSessions
            .AsNoTracking()
            .AnyAsync(
                session =>
                    session.AnnotatorId == annotatorId &&
                    session.Video.DatasetId == datasetId &&
                    (session.Status ==
                        AnnotationSessionStatus.Assigned ||
                     session.Status ==
                        AnnotationSessionStatus.InProgress),
                cancellationToken);

        if (hasActiveAssignment)
        {
            throw new TaskRequestConflictException(
                "This annotator already has an active assignment for this dataset.");
        }

        var existingRequest =
            await context.AnnotationTaskRequests
                .AsNoTracking()
                .SingleOrDefaultAsync(
                    request =>
                        request.AnnotatorId == annotatorId &&
                        request.DatasetId == datasetId &&
                        request.Status ==
                            AnnotationTaskRequestStatus.Waiting,
                    cancellationToken);

        if (existingRequest is not null)
        {
            throw new TaskRequestConflictException(
                "The annotator already has a waiting " +
                "request for this dataset.");
        }

        var request = new AnnotationTaskRequest
        {
            AnnotatorId = annotatorId,
            DatasetId = datasetId,
            Status = AnnotationTaskRequestStatus.Waiting,
            RequestedAt = DateTimeOffset.UtcNow
        };

        context.AnnotationTaskRequests.Add(request);

        try
        {
            await context.SaveChangesAsync(
                cancellationToken);
        }
        catch (DbUpdateException exception)
        {
            throw new TaskRequestConflictException(
                "A waiting request already exists.",
                exception);
        }

        return new TaskRequestResult(
            request.Id,
            request.AnnotatorId,
            request.DatasetId,
            request.Status,
            request.RequestedAt,
            request.FulfilledAt,
            request.CancelledAt,
            request.AnnotationSessionId);
    }

    public async Task<IReadOnlyList<TaskRequestResult>>
        GetRequestsAsync(
            int? datasetId,
            string? status,
            CancellationToken cancellationToken = default)
    {
        var query = context.AnnotationTaskRequests
            .AsNoTracking()
            .AsQueryable();

        if (datasetId.HasValue)
        {
            query = query.Where(
                request =>
                    request.DatasetId == datasetId.Value);
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(
                request => request.Status == status);
        }

        return await query
            .OrderBy(request => request.RequestedAt)
            .Select(request => new TaskRequestResult(
                request.Id,
                request.AnnotatorId,
                request.DatasetId,
                request.Status,
                request.RequestedAt,
                request.FulfilledAt,
                request.CancelledAt,
                request.AnnotationSessionId))
            .ToListAsync(cancellationToken);
    }

    public async Task<AssignmentOutcome>
        AssignNextAsync(
            int datasetId,
            int assignmentDurationDays,
            CancellationToken cancellationToken = default)
    {
        if (datasetId <= 0)
        {
            throw new ArgumentException(
                "A valid dataset ID is required.");
        }

        if (assignmentDurationDays <= 0 ||
            assignmentDurationDays > 365)
{
            throw new ArgumentException(
            "Assignment duration must be between " +
            "1 and 365 days.");
}

        await using var transaction =
            await context.Database.BeginTransactionAsync(
                IsolationLevel.Serializable,
                cancellationToken);

        var dataset = await context.Datasets
            .SingleOrDefaultAsync(
                item => item.Id == datasetId,
                cancellationToken);

        if (dataset is null)
        {
            throw new KeyNotFoundException(
                $"Dataset {datasetId} does not exist.");
        }

        if (dataset.IsArchived)
        {
            throw new TaskRequestConflictException(
                $"Dataset '{dataset.Name}' is archived.");
        }

        var request = await context.AnnotationTaskRequests
            .Where(item =>
                item.DatasetId == datasetId &&
                item.Status ==
                    AnnotationTaskRequestStatus.Waiting)
            .OrderBy(item =>
                context.AnnotationSessions.Count(
                    session =>
                        session.AnnotatorId ==
                            item.AnnotatorId &&
                        (session.Status ==
                            AnnotationSessionStatus.Assigned ||
                         session.Status ==
                            AnnotationSessionStatus.InProgress)))
            .ThenBy(item => item.RequestedAt)
            .ThenBy(item => item.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (request is null)
        {
            await transaction.CommitAsync(
                cancellationToken);

            return new AssignmentOutcome(
                false,
                "No annotator is currently waiting " +
                "for this dataset.",
                null,
                null,
                null,
                null,
                null);
        }

        var video = await context.Videos
            .Where(item =>
                item.DatasetId == datasetId &&
                !item.IsArchived &&
                item.ProcessingStatus == "Ready" &&
                !context.AnnotationSessions.Any(
                    session =>
                        session.VideoId == item.Id &&
                        session.AnnotatorId ==
                            request.AnnotatorId) &&
                context.AnnotationSessions.Count(
                    session =>
                        session.VideoId == item.Id &&
                        (session.Status ==
                            AnnotationSessionStatus.Assigned ||
                         session.Status ==
                            AnnotationSessionStatus.InProgress ||
                         session.Status ==
                            AnnotationSessionStatus.Completed))
                    < item.RequiredAnnotationCount)
            .OrderBy(item => item.DatasetRowIndex)
            .ThenBy(item => item.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (video is null)
        {
            await transaction.CommitAsync(
                cancellationToken);

            return new AssignmentOutcome(
                false,
                "No eligible video is currently available. " +
                "The request remains waiting.",
                request.Id,
                request.AnnotatorId,
                null,
                null,
                null);
        }

        var now = DateTimeOffset.UtcNow;

        var session = new AnnotationSession
        {
            AnnotatorId = request.AnnotatorId,
            VideoId = video.Id,
            Status = AnnotationSessionStatus.Assigned,
            AssignedAt = now,
            ExpiresAt =
                now.AddDays(assignmentDurationDays)
        };

        context.AnnotationSessions.Add(session);

        request.Status =
            AnnotationTaskRequestStatus.Fulfilled;

        request.FulfilledAt = now;

        await context.SaveChangesAsync(
            cancellationToken);

        request.AnnotationSessionId = session.Id;

        await context.SaveChangesAsync(
            cancellationToken);

        await transaction.CommitAsync(
            cancellationToken);

        return new AssignmentOutcome(
            true,
            "The task was assigned successfully.",
            request.Id,
            request.AnnotatorId,
            session.Id,
            video.Id,
            session.ExpiresAt);
    }

    public async Task<bool> CancelRequestAsync(
        int requestId,
        CancellationToken cancellationToken = default)
    {
        var request =
            await context.AnnotationTaskRequests
                .SingleOrDefaultAsync(
                    item =>
                        item.Id == requestId &&
                        item.Status ==
                            AnnotationTaskRequestStatus.Waiting,
                    cancellationToken);

        if (request is null)
        {
            return false;
        }

        request.Status =
            AnnotationTaskRequestStatus.Cancelled;

        request.CancelledAt =
            DateTimeOffset.UtcNow;

        await context.SaveChangesAsync(
            cancellationToken);

        return true;
    }

    public async Task<IReadOnlyList<SessionResult>>
        GetSessionsAsync(
            CancellationToken cancellationToken = default)
    {
        return await context.AnnotationSessions
            .AsNoTracking()
            .OrderByDescending(
                session => session.AssignedAt)
            .Select(session => new SessionResult(
                session.Id,
                session.AnnotatorId,
                session.VideoId,
                session.Status,
                session.AssignedAt,
                session.ExpiresAt,
                session.StartedAt,
                session.CompletedAt,
                session.CancelledAt))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<SessionResult>> GetSessionsForAnnotatorAsync(
        int annotatorId,
        CancellationToken cancellationToken = default)
    {
        return await context.AnnotationSessions
            .AsNoTracking()
            .Where(session => session.AnnotatorId == annotatorId)
            .OrderByDescending(session => session.AssignedAt)
            .Select(session => new SessionResult(
                session.Id, session.AnnotatorId, session.VideoId, session.Status,
                session.AssignedAt, session.ExpiresAt, session.StartedAt,
                session.CompletedAt, session.CancelledAt))
            .ToListAsync(cancellationToken);
    }

    public async Task<SessionResult?> GetSessionAsync(
        int sessionId,
        CancellationToken cancellationToken = default)
    {
        return await context.AnnotationSessions
            .AsNoTracking()
            .Where(session => session.Id == sessionId)
            .Select(session => new SessionResult(
                session.Id,
                session.AnnotatorId,
                session.VideoId,
                session.Status,
                session.AssignedAt,
                session.ExpiresAt,
                session.StartedAt,
                session.CompletedAt,
                session.CancelledAt))
            .SingleOrDefaultAsync(cancellationToken);
    }

    public async Task<SessionCompletionResult>
        CompleteSessionAsync(
            int sessionId,
            CancellationToken cancellationToken = default)
    {
        var session = await context.AnnotationSessions
            .Include(item => item.Video)
            .Include(item => item.SegmentResponses)
                .ThenInclude(item => item.QuestionAnswers)
            .SingleOrDefaultAsync(
                item => item.Id == sessionId,
                cancellationToken);

        if (session is null)
        {
            return new SessionCompletionResult(
                false,
                "Annotation session was not found.");
        }

        if (session.Status == AnnotationSessionStatus.Completed)
        {
            return new SessionCompletionResult(
                true,
                "This annotation has already been completed.");
        }

        var hasTranscript = session.SegmentResponses
            .Any(segment =>
                !string.IsNullOrWhiteSpace(segment.Transcript));

        if (!hasTranscript)
        {
            return new SessionCompletionResult(
                false,
                "Add a transcription before finishing this video.");
        }

        var activeQuestionIds = await context.Questions
            .Where(question =>
                question.IsActive &&
                question.DatasetId == session.Video.DatasetId)
            .Select(question => question.Id)
            .ToListAsync(cancellationToken);

        if (activeQuestionIds.Count > 0)
        {
            var answeredQuestionIds = session.SegmentResponses
                .SelectMany(segment => segment.QuestionAnswers)
                .Where(answer => !string.IsNullOrWhiteSpace(answer.Answer))
                .Select(answer => answer.QuestionId)
                .ToHashSet();

            var missingAnswers = activeQuestionIds.Any(questionId => !answeredQuestionIds.Contains(questionId));

            if (missingAnswers)
            {
                return new SessionCompletionResult(
                    false,
                    "Answer all required questions before finishing this video.");
            }
        }

        session.Status = AnnotationSessionStatus.Completed;
        session.CompletedAt = DateTimeOffset.UtcNow;
        session.StartedAt ??= session.AssignedAt;

        await context.SaveChangesAsync(cancellationToken);

        return new SessionCompletionResult(
            true,
            "Annotation completed successfully.");
    }

    public async Task<ExpirationProcessingResult>
        ProcessExpiredAssignmentsAsync(
            int reassignmentDurationDays,
            CancellationToken cancellationToken = default)
    {
        if (reassignmentDurationDays <= 0 ||
            reassignmentDurationDays > 365)
        {
            throw new ArgumentException(
                "Reassignment duration must be between " +
                "1 and 365 days.");
        }

        var now = DateTimeOffset.UtcNow;

        var expiredSessions =
            await context.AnnotationSessions
                .Include(session => session.Video)
                .Where(session =>
                    (session.Status ==
                        AnnotationSessionStatus.Assigned ||
                     session.Status ==
                        AnnotationSessionStatus.InProgress) &&
                    session.ExpiresAt <= now)
                .ToListAsync(cancellationToken);

        foreach (var session in expiredSessions)
        {
            session.Status =
                AnnotationSessionStatus.Expired;
        }

        await context.SaveChangesAsync(
            cancellationToken);

        var assignmentOutcomes =
            new List<AssignmentOutcome>();

        var expiredByDataset = expiredSessions
            .Where(session =>
                session.Video.DatasetId.HasValue)
            .GroupBy(session =>
                session.Video.DatasetId!.Value);

        foreach (var datasetGroup in expiredByDataset)
        {
            var expiredSlotCount =
                datasetGroup.Count();

            for (var index = 0;
                 index < expiredSlotCount;
                 index++)
            {
                var outcome = await AssignNextAsync(
                    datasetGroup.Key,
                    reassignmentDurationDays,
                    cancellationToken);

                assignmentOutcomes.Add(outcome);

                if (!outcome.Assigned)
                {
                    break;
                }
            }
        }

        return new ExpirationProcessingResult(
            expiredSessions.Count,
            assignmentOutcomes.Count(
                outcome => outcome.Assigned),
            now,
            assignmentOutcomes);
    }
}

public sealed record TaskRequestResult(
    int Id,
    int AnnotatorId,
    int DatasetId,
    string Status,
    DateTimeOffset RequestedAt,
    DateTimeOffset? FulfilledAt,
    DateTimeOffset? CancelledAt,
    int? AnnotationSessionId);

public sealed record AutomaticTaskRequestResult(
    TaskRequestResult Request,
    AssignmentOutcome Assignment);

public sealed record WaitingRequestProcessingResult(
    int AssignedSessionCount,
    DateTimeOffset ProcessedAt,
    IReadOnlyList<AssignmentOutcome> Assignments);

public sealed record AssignmentOutcome(
    bool Assigned,
    string Message,
    int? RequestId,
    int? AnnotatorId,
    int? AnnotationSessionId,
    int? VideoId,
    DateTimeOffset? ExpiresAt);

public sealed record SessionResult(
    int Id,
    int AnnotatorId,
    int VideoId,
    string Status,
    DateTimeOffset AssignedAt,
    DateTimeOffset ExpiresAt,
    DateTimeOffset? StartedAt,
    DateTimeOffset? CompletedAt,
    DateTimeOffset? CancelledAt);

public sealed record SessionCompletionResult(
    bool Success,
    string Message);

public sealed record ExpirationProcessingResult(
    int ExpiredSessionCount,
    int ReassignedSessionCount,
    DateTimeOffset ProcessedAt,
    IReadOnlyList<AssignmentOutcome>
        AssignmentOutcomes);

public sealed class TaskRequestConflictException
    : Exception
{
    public TaskRequestConflictException(
        string message)
        : base(message)
    {
    }

    public TaskRequestConflictException(
        string message,
        Exception innerException)
        : base(message, innerException)
    {
    }
}