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
        var question = await context.Questions.AsNoTracking().SingleOrDefaultAsync(item => item.Id == request.QuestionId && item.IsActive, ct);
        var segment = await context.SegmentResponses.AsNoTracking().SingleOrDefaultAsync(item => item.Id == request.SegmentResponseId, ct);
        if (question is null || segment is null) return Results.BadRequest(new { message = "An active question and valid segment response are required." });
        if (question.SegmentNo != segment.SegmentNumber) return Results.BadRequest(new { message = "The question does not belong to this segment number." });
        var answer = new QuestionAnswer { SegmentResponseId = request.SegmentResponseId, QuestionId = request.QuestionId, Answer = request.Answer.Trim() };
        context.QuestionAnswers.Add(answer);
        await context.SaveChangesAsync(ct);
        return Results.Created($"/api/question-answers/{answer.SegmentResponseId}/{answer.QuestionId}", new QuestionAnswerResponse(answer.SegmentResponseId, answer.QuestionId, answer.Answer));
    }

    private static async Task<IResult> UpdateAnswerAsync(int segmentResponseId, int questionId, QuestionAnswerUpdateRequest request, AppDbContext context, CancellationToken ct)
    {
        var answer = await context.QuestionAnswers.SingleOrDefaultAsync(item => item.SegmentResponseId == segmentResponseId && item.QuestionId == questionId, ct);
        if (answer is null) return Results.NotFound();
        answer.Answer = request.Answer.Trim();
        await context.SaveChangesAsync(ct);
        return Results.Ok(new QuestionAnswerResponse(answer.SegmentResponseId, answer.QuestionId, answer.Answer));
    }

    public sealed record QuestionAnswerRequest(int SegmentResponseId, int QuestionId, string Answer);
    public sealed record QuestionAnswerUpdateRequest(string Answer);
    public sealed record QuestionAnswerResponse(int SegmentResponseId, int QuestionId, string Answer);
}
