using Context.Entities;
using Service;

namespace Api.Endpoints;

public static class QuestionEndpoints
{
    public static RouteGroupBuilder MapQuestionEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/questions").WithTags("Questions");

        // GET ALL
        group.MapGet("/", async (IEntityService<Question> service, CancellationToken ct) =>
            Results.Ok((await service.GetAllAsync(ct))
                .OrderBy(q => q.QuestionNumber)
                .Select(q => new { q.Id, q.QuestionNumber, q.Text })));

        // ADD POST ENDPOINT
        group.MapPost("/", async (QuestionRequest r, IEntityService<Question> service, CancellationToken ct) =>
        {
            var q = await service.CreateAsync(new Question { QuestionNumber = r.QuestionNumber, Text = r.Text }, ct);
            return Results.Created($"/api/questions/{q.Id}", new { q.Id, q.QuestionNumber, q.Text });
        });

        return group;
    }

    public sealed record QuestionRequest(int QuestionNumber, string Text);
}