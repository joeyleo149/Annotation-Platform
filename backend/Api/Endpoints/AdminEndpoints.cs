using Context.Entities;
using Service;

namespace Api.Endpoints;

public static class AdminEndpoints
{
    public static RouteGroupBuilder MapAdminEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/admins").WithTags("Admins");
        group.MapGet("/", async (IEntityService<Admin> service, CancellationToken ct) =>
            Results.Ok((await service.GetAllAsync(ct)).Select(ToResponse)));
        group.MapGet("/{id:int}", async (int id, IEntityService<Admin> service, CancellationToken ct) =>
            await service.GetByIdAsync([id], ct) is { } item ? Results.Ok(ToResponse(item)) : Results.NotFound());
        group.MapPost("/", async (AdminRequest request, IEntityService<Admin> service, CancellationToken ct) =>
        {
            var item = await service.CreateAsync(new Admin { Name = request.Name, Email = request.Email, PasswordHash = request.PasswordHash }, ct);
            return Results.Created($"/api/admins/{item.Id}", ToResponse(item));
        });
        group.MapPut("/{id:int}", async (int id, AdminRequest request, IEntityService<Admin> service, CancellationToken ct) =>
        {
            var item = await service.GetByIdAsync([id], ct);
            if (item is null) return Results.NotFound();
            item.Name = request.Name; item.Email = request.Email; item.PasswordHash = request.PasswordHash;
            await service.UpdateAsync(item, ct);
            return Results.Ok(ToResponse(item));
        });
        group.MapDelete("/{id:int}", async (int id, IEntityService<Admin> service, CancellationToken ct) =>
            await service.DeleteAsync([id], ct) ? Results.NoContent() : Results.NotFound());
        return group;
    }

    private static AdminResponse ToResponse(Admin item) => new(item.Id, item.Name, item.Email);
    public sealed record AdminRequest(string Name, string Email, string PasswordHash);
    public sealed record AdminResponse(int Id, string Name, string Email);
}
