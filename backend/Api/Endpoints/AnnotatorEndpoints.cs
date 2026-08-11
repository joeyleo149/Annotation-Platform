using Context.Entities;
using Service;

namespace Api.Endpoints;

public static class AnnotatorEndpoints
{
    public static RouteGroupBuilder MapAnnotatorEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/annotators").WithTags("Annotators");
        group.MapGet("/", async (IEntityService<Annotator> service, CancellationToken ct) =>
            Results.Ok((await service.GetAllAsync(ct)).Select(ToResponse)));
        group.MapGet("/{id:int}", async (int id, IEntityService<Annotator> service, CancellationToken ct) =>
            await service.GetByIdAsync([id], ct) is { } item ? Results.Ok(ToResponse(item)) : Results.NotFound());
        group.MapPost("/", async (AnnotatorRequest request, IEntityService<Annotator> service, CancellationToken ct) =>
        {
            var item = await service.CreateAsync(ToEntity(request), ct);
            return Results.Created($"/api/annotators/{item.Id}", ToResponse(item));
        });
        group.MapPut("/{id:int}", async (int id, AnnotatorRequest request, IEntityService<Annotator> service, CancellationToken ct) =>
        {
            var item = await service.GetByIdAsync([id], ct);
            if (item is null) return Results.NotFound();
            item.Name = request.Name; item.Email = request.Email; item.PasswordHash = request.PasswordHash;
            item.DateOfBirth = request.DateOfBirth; item.Gender = request.Gender; item.Nationality = request.Nationality;
            await service.UpdateAsync(item, ct);
            return Results.Ok(ToResponse(item));
        });
        group.MapDelete("/{id:int}", async (int id, IEntityService<Annotator> service, CancellationToken ct) =>
            await service.DeleteAsync([id], ct) ? Results.NoContent() : Results.NotFound());
        return group;
    }

    private static Annotator ToEntity(AnnotatorRequest r) => new() { Name = r.Name, Email = r.Email, PasswordHash = r.PasswordHash, DateOfBirth = r.DateOfBirth, Gender = r.Gender, Nationality = r.Nationality };
    private static AnnotatorResponse ToResponse(Annotator x) => new(x.Id, x.Name, x.Email, x.DateOfBirth, x.Gender, x.Nationality);
    public sealed record AnnotatorRequest(string Name, string Email, string PasswordHash, DateOnly DateOfBirth, string Gender, string Nationality);
    public sealed record AnnotatorResponse(int Id, string Name, string Email, DateOnly DateOfBirth, string Gender, string Nationality);
}
