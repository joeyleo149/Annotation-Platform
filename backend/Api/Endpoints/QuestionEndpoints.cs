using System.Security.Claims;
using Context;
using Context.Entities;
using Microsoft.EntityFrameworkCore;

namespace Api.Endpoints;

public static class QuestionEndpoints
{
    public static RouteGroupBuilder MapQuestionEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/questions").WithTags("Questions");
        group.MapGet("/", GetQuestionsAsync);
        group.MapPost("/", CreateQuestionAsync).RequireAuthorization(policy => policy.RequireRole("Admin"));
        group.MapPatch("/{id:int}/active", SetActiveAsync).RequireAuthorization(policy => policy.RequireRole("Admin"));
        return group;
    }

    private static async Task<IResult> GetQuestionsAsync(int? datasetId, bool includeInactive, ClaimsPrincipal user, AppDbContext context, CancellationToken ct)
    {
        var query = context.Questions.AsNoTracking().AsQueryable();

        if (datasetId.HasValue && datasetId.Value > 0)
        {
            query = query.Where(question => question.DatasetId == datasetId.Value);
        }

        if (!user.IsInRole("Admin") || !includeInactive) query = query.Where(question => question.IsActive);

        var questions = await query.OrderBy(question => question.SegmentNo).ThenBy(question => question.Id)
            .Select(question => new QuestionResponse(question.Id, question.DatasetId, question.QuestionText, question.SegmentNo, question.IsActive))
            .ToListAsync(ct);
        return Results.Ok(questions);
    }

    private static async Task<IResult> CreateQuestionAsync(QuestionRequest request, AppDbContext context, CancellationToken ct)
    {
        var text = request.QuestionText?.Trim();
        if (string.IsNullOrWhiteSpace(text)) return Results.BadRequest(new { message = "Question text is required." });
        if (request.SegmentNo is < 1 or > 3) return Results.BadRequest(new { message = "Segment number must be 1, 2, or 3." });
        if (request.DatasetId <= 0)
        {
            return Results.BadRequest(new { message = "A valid dataset is required for the question." });
        }

        var datasetExists = await context.Datasets.AnyAsync(item => item.Id == request.DatasetId, ct);
        if (!datasetExists)
        {
            return Results.BadRequest(new { message = $"Dataset {request.DatasetId} does not exist." });
        }

        var question = new Question { DatasetId = request.DatasetId, QuestionText = text, SegmentNo = request.SegmentNo, IsActive = true };
        context.Questions.Add(question);
        await context.SaveChangesAsync(ct);
        return Results.Created($"/api/questions/{question.Id}", new QuestionResponse(question.Id, question.DatasetId, question.QuestionText, question.SegmentNo, question.IsActive));
    }

    private static async Task<IResult> SetActiveAsync(int id, ActiveRequest request, AppDbContext context, CancellationToken ct)
    {
        var question = await context.Questions.SingleOrDefaultAsync(item => item.Id == id, ct);
        if (question is null) return Results.NotFound(new { message = "Question was not found." });
        question.IsActive = request.IsActive;
        await context.SaveChangesAsync(ct);
        return Results.Ok(new QuestionResponse(question.Id, question.DatasetId, question.QuestionText, question.SegmentNo, question.IsActive));
    }

    public sealed record QuestionRequest(string QuestionText, int SegmentNo, int DatasetId);
    public sealed record ActiveRequest(bool IsActive);
    public sealed record QuestionResponse(int Id, int? DatasetId, string QuestionText, int SegmentNo, bool IsActive);
}
