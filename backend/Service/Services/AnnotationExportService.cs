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

        var activeQuestions = await GetActiveQuestionsAsync(video.DatasetId, cancellationToken);
        var document = CreateDocument("Video", video.Dataset, [video], includeIncomplete, activeQuestions);
        return CreateExportFile(document, format, $"video-{video.Id}-annotations");
    }

    public async Task<AnnotationExportFile?> ExportDatasetAsync(int datasetId, string format, bool includeIncomplete, CancellationToken cancellationToken = default)
    {
        ValidateFormat(format);
        var dataset = await context.Datasets.AsNoTracking().SingleOrDefaultAsync(item => item.Id == datasetId, cancellationToken);
        if (dataset is null) return null;

        var videos = await BuildVideoQuery().Where(video => video.DatasetId == datasetId)
            .OrderBy(video => video.DatasetRowIndex).ThenBy(video => video.Id).ToListAsync(cancellationToken);

        var activeQuestions = await GetActiveQuestionsAsync(datasetId, cancellationToken);
        var document = CreateDocument("Dataset", dataset, videos, includeIncomplete, activeQuestions);

        var safeDatasetName = CreateSafeFileName(dataset.Name);
        return CreateExportFile(document, format, $"dataset-{dataset.Id}-{safeDatasetName}-annotations");
    }

    private async Task<IReadOnlyList<Question>> GetActiveQuestionsAsync(int? datasetId, CancellationToken ct)
    {
        if (!datasetId.HasValue) return [];
        return await context.Questions.AsNoTracking()
            .Where(question => question.IsActive && question.DatasetId == datasetId.Value)
            .ToListAsync(ct);
    }

    private static AnnotationExportDocument CreateDocument(string scope, Dataset? dataset, IReadOnlyCollection<Video> videos, bool includeIncomplete, IReadOnlyList<Question> activeQuestions)
    {
        var exportedVideos = videos.Select(video => CreateVideoExport(video, includeIncomplete, activeQuestions)).ToList();

        return new AnnotationExportDocument(
            DateTimeOffset.UtcNow, scope, dataset?.Id, dataset?.Name,
            exportedVideos.Count, exportedVideos.Sum(video => video.Sessions.Count), exportedVideos);
    }

    private static VideoAnnotationExport CreateVideoExport(Video video, bool includeIncomplete, IReadOnlyList<Question> activeQuestions)
    {
        var sessions = video.AnnotationSessions
            .Where(session => includeIncomplete || session.Status == AnnotationSessionStatus.Completed)
            .OrderBy(session => session.Id)
            .Select(session =>
            {
                var segments = session.SegmentResponses
                    .OrderBy(segment => segment.SegmentNumber)
                    .Select(segment =>
                    {
                        var answeredByQuestionId = segment.QuestionAnswers.ToDictionary(a => a.QuestionId, a => a.Answer);
                        var questionAnswers = activeQuestions
                            .Where(question => question.SegmentNo == segment.SegmentNumber)
                            .Select(question => new QuestionAnswerExport(
                                question.Id,
                                answeredByQuestionId.TryGetValue(question.Id, out var answer) ? answer : "-"))
                            .OrderBy(qa => qa.QuestionId)
                            .ToList();

                        return new SegmentAnnotationExport(
                            segment.Id, segment.SegmentNumber, segment.Transcript, segment.SubmittedAt, questionAnswers);
                    })
                    .ToList();

                return new AnnotationSessionExport(
                    session.Id, session.AnnotatorId, session.Annotator.Name, session.Status,
                    session.AssignedAt, session.ExpiresAt, session.StartedAt, session.CompletedAt, segments);
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
                "SegmentNumber",
                "Transcript",
                "SegmentSubmittedAt",
                "QuestionId",
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
                    if (segment.QuestionAnswers.Count == 0)
                    {
                        AppendCsvRow(
                            builder,
                            CreateCsvValues(
                                document,
                                video,
                                session,
                                segment,
                                null));

                        continue;
                    }

                    foreach (var answer
                             in segment.QuestionAnswers)
                    {
                        AppendCsvRow(
                            builder,
                            CreateCsvValues(
                                document,
                                video,
                                session,
                                segment,
                                answer));
                    }
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
        QuestionAnswerExport? answer)
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
            segment?.SegmentNumber.ToString(
                CultureInfo.InvariantCulture),
            segment?.Transcript,
            segment?.SubmittedAt.ToString("O"),
            answer?.QuestionId.ToString(
                CultureInfo.InvariantCulture),
            answer?.Answer
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
    IReadOnlyList<SegmentAnnotationExport> Segments);

public sealed record SegmentAnnotationExport(
    int SegmentResponseId,
    int SegmentNumber,
    string Transcript,
    DateTimeOffset SubmittedAt,
    IReadOnlyList<QuestionAnswerExport>
        QuestionAnswers);

public sealed record QuestionAnswerExport(
    int QuestionId,
    string Answer);
