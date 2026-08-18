using System.Globalization;
using System.Text;
using System.Text.Json;
using Context;
using Context.Entities;
using Microsoft.EntityFrameworkCore;

namespace Service.Services;

public sealed class AnnotationExportService(
    AppDbContext context)
{
    private static readonly JsonSerializerOptions
        JsonOptions = new()
        {
            WriteIndented = true
        };

    public async Task<AnnotationExportFile?> ExportVideoAsync(int videoId, string format, bool includeIncomplete, CancellationToken cancellationToken = default)
    {
        ValidateFormat(format);
        var video = await BuildVideoQuery().SingleOrDefaultAsync(item => item.Id == videoId, cancellationToken);
        if (video is null) return null;

        var questions = await GetQuestionsAsync(video.DatasetId, cancellationToken);
        var document = CreateDocument("Video", video.Dataset, [video], includeIncomplete, questions);
        return CreateExportFile(document, format, $"video-{video.Id}-annotations");
    }

    public async Task<AnnotationExportFile?> ExportDatasetAsync(int datasetId, string format, bool includeIncomplete, CancellationToken cancellationToken = default)
    {
        ValidateFormat(format);
        var dataset = await context.Datasets.AsNoTracking().SingleOrDefaultAsync(item => item.Id == datasetId, cancellationToken);
        if (dataset is null) return null;

        var videos = await BuildVideoQuery().Where(video => video.DatasetId == datasetId)
            .OrderBy(video => video.DatasetRowIndex).ThenBy(video => video.Id).ToListAsync(cancellationToken);

        var questions = await GetQuestionsAsync(datasetId, cancellationToken);
        var document = CreateDocument("Dataset", dataset, videos, includeIncomplete, questions);

        var safeDatasetName = CreateSafeFileName(dataset.Name);
        return CreateExportFile(document, format, $"dataset-{dataset.Id}-{safeDatasetName}-annotations");
    }

    private async Task<IReadOnlyList<Question>> GetQuestionsAsync(int? datasetId, CancellationToken ct)
    {
        if (!datasetId.HasValue) return [];
        return await context.Questions.AsNoTracking()
            .Where(question => question.DatasetId == datasetId.Value)
            .OrderBy(question => question.SegmentNo)
            .ThenBy(question => question.Id)
            .ToListAsync(ct);
    }

    private static AnnotationExportDocument CreateDocument(string scope, Dataset? dataset, IReadOnlyCollection<Video> videos, bool includeIncomplete, IReadOnlyList<Question> questions)
    {
        var exportedVideos = videos.Select(video => CreateVideoExport(video, includeIncomplete, questions)).ToList();

        return new AnnotationExportDocument(
            DateTimeOffset.UtcNow, scope, dataset?.Id, dataset?.Name,
            exportedVideos.Count, exportedVideos.Sum(video => video.Sessions.Count), exportedVideos);
    }

    private static VideoAnnotationExport CreateVideoExport(Video video, bool includeIncomplete, IReadOnlyList<Question> questions)
    {
        var sessions = video.AnnotationSessions
            .Where(session => includeIncomplete || session.Status == AnnotationSessionStatus.Completed)
            .OrderBy(session => session.Id)
            .Select(session =>
            {
                var answerByQuestionId = session.SegmentResponses
                    .SelectMany(segment => segment.QuestionAnswers.Select(answer => new
                    {
                        answer.QuestionId,
                        answer.Answer,
                        SegmentResponseId = segment.Id,
                        segment.SubmittedAt
                    }))
                    .GroupBy(item => item.QuestionId)
                    .ToDictionary(
                        group => group.Key,
                        group => group.OrderByDescending(item => item.SubmittedAt).First());

                var sessionQuestions = questions
                    .Select(question =>
                    {
                        var isAnswered = answerByQuestionId.TryGetValue(question.Id, out var savedAnswer);
                        return new SessionQuestionExport(
                            question.Id,
                            question.QuestionText,
                            question.SegmentNo,
                            question.IsActive,
                            isAnswered,
                            isAnswered ? savedAnswer!.Answer : null,
                            isAnswered ? savedAnswer!.SegmentResponseId : null);
                    })
                    .ToList();

                var segments = session.SegmentResponses
                    .OrderBy(segment => segment.SegmentNumber)
                    .Select(segment =>
                    {
                        var questionById = questions.ToDictionary(question => question.Id);
                        var questionAnswers = segment.QuestionAnswers
                            .Select(answer =>
                            {
                                questionById.TryGetValue(answer.QuestionId, out var question);
                                return new QuestionAnswerExport(
                                    answer.QuestionId,
                                    question?.QuestionText ?? "Question no longer exists",
                                    question?.SegmentNo,
                                    question?.IsActive ?? false,
                                    answer.Answer);
                            })
                            .OrderBy(qa => qa.QuestionId)
                            .ToList();

                        return new SegmentAnnotationExport(
                            segment.Id, segment.SegmentNumber, segment.Transcript, segment.SubmittedAt, questionAnswers);
                    })
                    .ToList();

                return new AnnotationSessionExport(
                    session.Id, session.AnnotatorId, session.Annotator.Name, session.Status,
                    session.AssignedAt, session.ExpiresAt, session.StartedAt, session.CompletedAt,
                    sessionQuestions, segments);
            })
            .ToList();

        return new VideoAnnotationExport(
            video.Id, video.DatasetId, video.FileName, video.ScenarioId, video.DatasetRowIndex,
            video.ScenarioType, video.DrivingInstruction, video.RequiredAnnotationCount,
            sessions.Count(session => session.Status == AnnotationSessionStatus.Completed),
            video.IsArchived, sessions);
    }

    private IQueryable<Video> BuildVideoQuery()
    {
        return context.Videos
            .AsNoTracking()
            .AsSplitQuery()
            .Include(video => video.Dataset)
            .Include(video =>
                video.AnnotationSessions)
                .ThenInclude(session =>
                    session.Annotator)
            .Include(video =>
                video.AnnotationSessions)
                .ThenInclude(session =>
                    session.SegmentResponses)
                .ThenInclude(segment =>
                    segment.QuestionAnswers);
    }

    private static AnnotationExportFile CreateExportFile(
        AnnotationExportDocument document,
        string format,
        string baseFileName)
    {
        if (string.Equals(
                format,
                "csv",
                StringComparison.OrdinalIgnoreCase))
        {
            var csv = CreateCsv(document);

            return new AnnotationExportFile(
                Encoding.UTF8.GetBytes(csv),
                "text/csv; charset=utf-8",
                $"{baseFileName}.csv");
        }

        var json =
            JsonSerializer.SerializeToUtf8Bytes(
                document,
                JsonOptions);

        return new AnnotationExportFile(
            json,
            "application/json",
            $"{baseFileName}.json");
    }

    private static string CreateCsv(
        AnnotationExportDocument document)
    {
        var builder = new StringBuilder();

        AppendCsvRow(
            builder,
            [
                "DatasetId",
                "DatasetName",
                "VideoId",
                "VideoFileName",
                "ScenarioId",
                "DatasetRowIndex",
                "SessionId",
                "AnnotatorId",
                "AnnotatorName",
                "SessionStatus",
                "AssignedAt",
                "ExpiresAt",
                "CompletedAt",
                "StartedAt",
                "SegmentNumber",
                "Transcript",
                "SegmentSubmittedAt",
                "QuestionId",
                "QuestionText",
                "QuestionSegmentNumber",
                "QuestionIsActive",
                "QuestionIsAnswered",
                "AnswerSegmentResponseId",
                "Answer"
            ]);

        foreach (var video in document.Videos)
        {
            if (video.Sessions.Count == 0)
            {
                AppendCsvRow(
                    builder,
                    CreateCsvValues(
                        document,
                        video,
                        null,
                        null,
                        null));

                continue;
            }

            foreach (var session in video.Sessions)
            {
                if (session.Questions.Count > 0)
                {
                    foreach (var question in session.Questions)
                    {
                        var answerSegment = question.AnswerSegmentResponseId.HasValue
                            ? session.Segments.FirstOrDefault(segment => segment.SegmentResponseId == question.AnswerSegmentResponseId.Value)
                            : session.Segments.FirstOrDefault(segment => segment.SegmentNumber == question.SegmentNumber);

                        AppendCsvRow(
                            builder,
                            CreateCsvValues(
                                document,
                                video,
                                session,
                                answerSegment,
                                question));
                    }

                    continue;
                }

                if (session.Segments.Count == 0)
                {
                    AppendCsvRow(
                        builder,
                        CreateCsvValues(
                            document,
                            video,
                            session,
                            null,
                            null));

                    continue;
                }

                foreach (var segment in session.Segments)
                {
                    AppendCsvRow(builder, CreateCsvValues(document, video, session, segment, null));
                }
            }
        }

        return builder.ToString();
    }

    private static string?[] CreateCsvValues(
        AnnotationExportDocument document,
        VideoAnnotationExport video,
        AnnotationSessionExport? session,
        SegmentAnnotationExport? segment,
        SessionQuestionExport? question)
    {
        return
        [
            document.DatasetId?.ToString(
                CultureInfo.InvariantCulture),
            document.DatasetName,
            video.VideoId.ToString(
                CultureInfo.InvariantCulture),
            video.FileName,
            video.ScenarioId,
            video.DatasetRowIndex?.ToString(
                CultureInfo.InvariantCulture),
            session?.SessionId.ToString(
                CultureInfo.InvariantCulture),
            session?.AnnotatorId.ToString(
                CultureInfo.InvariantCulture),
            session?.AnnotatorName,
            session?.Status,
            session?.AssignedAt.ToString("O"),
            session?.ExpiresAt.ToString("O"),
            session?.CompletedAt?.ToString("O"),
            session?.StartedAt?.ToString("O"),
            segment?.SegmentNumber.ToString(
                CultureInfo.InvariantCulture),
            segment?.Transcript,
            segment?.SubmittedAt.ToString("O"),
            question?.QuestionId.ToString(
                CultureInfo.InvariantCulture),
            question?.QuestionText,
            question?.SegmentNumber.ToString(CultureInfo.InvariantCulture),
            question?.IsActive.ToString(CultureInfo.InvariantCulture),
            question?.IsAnswered.ToString(CultureInfo.InvariantCulture),
            question?.AnswerSegmentResponseId?.ToString(CultureInfo.InvariantCulture),
            question?.Answer
        ];
    }

    private static void AppendCsvRow(
        StringBuilder builder,
        IEnumerable<string?> values)
    {
        builder.AppendLine(
            string.Join(
                ",",
                values.Select(EscapeCsv)));
    }

    private static string EscapeCsv(
        string? value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return string.Empty;
        }

        var escaped =
            value.Replace("\"", "\"\"");

        return value.Contains(',') ||
               value.Contains('"') ||
               value.Contains('\r') ||
               value.Contains('\n')
            ? $"\"{escaped}\""
            : escaped;
    }

    private static void ValidateFormat(
        string format)
    {
        if (!string.Equals(
                format,
                "json",
                StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(
                format,
                "csv",
                StringComparison.OrdinalIgnoreCase))
        {
            throw new ArgumentException(
                "Export format must be json or csv.");
        }
    }

    private static string CreateSafeFileName(
        string value)
    {
        var characters = value
            .Where(character =>
                char.IsLetterOrDigit(character) ||
                character == '-' ||
                character == '_')
            .ToArray();

        return characters.Length == 0
            ? "dataset"
            : new string(characters)
                .ToLowerInvariant();
    }
}

public sealed record AnnotationExportFile(
    byte[] Content,
    string ContentType,
    string FileName);

public sealed record AnnotationExportDocument(
    DateTimeOffset ExportedAt,
    string Scope,
    int? DatasetId,
    string? DatasetName,
    int VideoCount,
    int SessionCount,
    IReadOnlyList<VideoAnnotationExport> Videos);

public sealed record VideoAnnotationExport(
    int VideoId,
    int? DatasetId,
    string FileName,
    string? ScenarioId,
    int? DatasetRowIndex,
    string? ScenarioType,
    string? DrivingInstruction,
    int RequiredAnnotationCount,
    int CompletedAnnotationCount,
    bool IsArchived,
    IReadOnlyList<AnnotationSessionExport> Sessions);

public sealed record AnnotationSessionExport(
    int SessionId,
    int AnnotatorId,
    string AnnotatorName,
    string Status,
    DateTimeOffset AssignedAt,
    DateTimeOffset ExpiresAt,
    DateTimeOffset? StartedAt,
    DateTimeOffset? CompletedAt,
    IReadOnlyList<SessionQuestionExport> Questions,
    IReadOnlyList<SegmentAnnotationExport> Segments);

public sealed record SessionQuestionExport(
    int QuestionId,
    string QuestionText,
    int SegmentNumber,
    bool IsActive,
    bool IsAnswered,
    string? Answer,
    int? AnswerSegmentResponseId);

public sealed record SegmentAnnotationExport(
    int SegmentResponseId,
    int SegmentNumber,
    string Transcript,
    DateTimeOffset SubmittedAt,
    IReadOnlyList<QuestionAnswerExport>
        QuestionAnswers);

public sealed record QuestionAnswerExport(
    int QuestionId,
    string QuestionText,
    int? SegmentNumber,
    bool IsActive,
    string Answer);