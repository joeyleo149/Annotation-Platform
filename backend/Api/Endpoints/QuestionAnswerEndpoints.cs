using Context.Entities;
using Service;

namespace Api.Endpoints;

public static class QuestionAnswerEndpoints
{
    public static RouteGroupBuilder MapQuestionAnswerEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/question-answers").WithTags("Question Answers");
        group.MapGet("/", async (IEntityService<QuestionAnswer> service, CancellationToken ct) => Results.Ok((await service.GetAllAsync(ct)).Select(ToResponse)));
        group.MapGet("/{segmentResponseId:int}/{questionNumber:int}", async (int segmentResponseId, int questionNumber, IEntityService<QuestionAnswer> service, CancellationToken ct) =>
            await service.GetByIdAsync([segmentResponseId, questionNumber], ct) is { } x ? Results.Ok(ToResponse(x)) : Results.NotFound());
        group.MapPost("/", async (QuestionAnswerRequest r, IEntityService<QuestionAnswer> service, CancellationToken ct) =>
        {
            var x = await service.CreateAsync(new QuestionAnswer { SegmentResponseId = r.SegmentResponseId, QuestionNumber = r.QuestionNumber, Answer = r.Answer }, ct);
            return Results.Created($"/api/question-answers/{x.SegmentResponseId}/{x.QuestionNumber}", ToResponse(x));
        });
        group.MapPut("/{segmentResponseId:int}/{questionNumber:int}", async (int segmentResponseId, int questionNumber, QuestionAnswerUpdateRequest r, IEntityService<QuestionAnswer> service, CancellationToken ct) =>
        {
            var x = await service.GetByIdAsync([segmentResponseId, questionNumber], ct); if (x is null) return Results.NotFound();
            x.Answer = r.Answer; await service.UpdateAsync(x, ct); return Results.Ok(ToResponse(x));
        });
        group.MapDelete("/{segmentResponseId:int}/{questionNumber:int}", async (int segmentResponseId, int questionNumber, IEntityService<QuestionAnswer> service, CancellationToken ct) =>
            await service.DeleteAsync([segmentResponseId, questionNumber], ct) ? Results.NoContent() : Results.NotFound());
        return group;
    }
    private static QuestionAnswerResponse ToResponse(QuestionAnswer x) => new(x.SegmentResponseId, x.QuestionNumber, x.Answer);
    public sealed record QuestionAnswerRequest(int SegmentResponseId, int QuestionNumber, string Answer);
    public sealed record QuestionAnswerUpdateRequest(string Answer);
    public sealed record QuestionAnswerResponse(int SegmentResponseId, int QuestionNumber, string Answer);
}
