using Context.Entities;
using Service;

namespace Api.Endpoints;

public static class QuestionEndpoints
{
    public static RouteGroupBuilder MapQuestionEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/questions").WithTags("Questions");

        // Read-only for now — fixed global set. Admin CRUD to be added by whoever owns AdminEndpoints.cs.
        group.MapGet("/", async (IEntityService<Question> service, CancellationToken ct) =>
            Results.Ok((await service.GetAllAsync(ct))
                .OrderBy(q => q.QuestionNumber)
                .Select(q => new { q.Id, q.QuestionNumber, q.Text })));

        return group;
    }
}