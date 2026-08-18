using Context;
using Context.Entities;
using Microsoft.EntityFrameworkCore;

namespace Api.Endpoints;

public static class QuestionAnswerEndpoints
{
    public static RouteGroupBuilder MapQuestionAnswerEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/question-answers").WithTags("Question Answers");
        group.MapGet("/", GetAnswersAsync);
        group.MapGet("/{segmentResponseId:int}/{questionId:int}", GetAnswerAsync);
        group.MapPost("/", CreateAnswerAsync);
        group.MapPut("/{segmentResponseId:int}/{questionId:int}", UpdateAnswerAsync);
        return group;
    }

    private static async Task<IResult> GetAnswersAsync(int? segmentResponseId, AppDbContext context, CancellationToken ct)
    {
        var query = context.QuestionAnswers.AsNoTracking();
        if (segmentResponseId.HasValue) query = query.Where(answer => answer.SegmentResponseId == segmentResponseId.Value);
        return Results.Ok(await query.Select(answer => new QuestionAnswerResponse(answer.SegmentResponseId, answer.QuestionId, answer.Answer)).ToListAsync(ct));
    }

    private static async Task<IResult> GetAnswerAsync(int segmentResponseId, int questionId, AppDbContext context, CancellationToken ct)
    {
        var answer = await context.QuestionAnswers.AsNoTracking().SingleOrDefaultAsync(item => item.SegmentResponseId == segmentResponseId && item.QuestionId == questionId, ct);
        return answer is null ? Results.NotFound() : Results.Ok(new QuestionAnswerResponse(answer.SegmentResponseId, answer.QuestionId, answer.Answer));
    }

    private static async Task<IResult> CreateAnswerAsync(QuestionAnswerRequest request, AppDbContext context, CancellationToken ct)
    {
        var answerText = request.Answer?.Trim();
        if (string.IsNullOrWhiteSpace(answerText))
            return Results.BadRequest(new { message = "Answer text is required." });

        var question = await context.Questions.AsNoTracking().SingleOrDefaultAsync(item => item.Id == request.QuestionId && item.IsActive, ct);
        var segment = await context.SegmentResponses.AsNoTracking().SingleOrDefaultAsync(item => item.Id == request.SegmentResponseId, ct);
        if (question is null || segment is null) return Results.BadRequest(new { message = "An active question and valid segment response are required." });

        var alreadyAnswered = await context.QuestionAnswers.AnyAsync(
            item => item.SegmentResponseId == request.SegmentResponseId && item.QuestionId == request.QuestionId,
            ct);
        if (alreadyAnswered)
            return Results.Conflict(new { message = "This question has already been answered. Edit the saved answer instead." });

        // SegmentNo controls when and where the question appears in the UI.
        // The answer is attached to the annotation session through its current
        // SegmentResponse; it does not require a matching SegmentNumber because
        // this screen stores one response for the full video.
        var answer = new QuestionAnswer { SegmentResponseId = request.SegmentResponseId, QuestionId = request.QuestionId, Answer = answerText };
        context.QuestionAnswers.Add(answer);
        await context.SaveChangesAsync(ct);
        return Results.Created($"/api/question-answers/{answer.SegmentResponseId}/{answer.QuestionId}", new QuestionAnswerResponse(answer.SegmentResponseId, answer.QuestionId, answer.Answer));
    }

    private static async Task<IResult> UpdateAnswerAsync(int segmentResponseId, int questionId, QuestionAnswerUpdateRequest request, AppDbContext context, CancellationToken ct)
    {
        var answerText = request.Answer?.Trim();
        if (string.IsNullOrWhiteSpace(answerText))
            return Results.BadRequest(new { message = "Answer text is required." });

        var answer = await context.QuestionAnswers.SingleOrDefaultAsync(item => item.SegmentResponseId == segmentResponseId && item.QuestionId == questionId, ct);
        if (answer is null) return Results.NotFound(new { message = "The answer was not found." });
        answer.Answer = answerText;
        await context.SaveChangesAsync(ct);
        return Results.Ok(new QuestionAnswerResponse(answer.SegmentResponseId, answer.QuestionId, answer.Answer));
    }

    public sealed record QuestionAnswerRequest(int SegmentResponseId, int QuestionId, string Answer);
    public sealed record QuestionAnswerUpdateRequest(string Answer);
    public sealed record QuestionAnswerResponse(int SegmentResponseId, int QuestionId, string Answer);
}