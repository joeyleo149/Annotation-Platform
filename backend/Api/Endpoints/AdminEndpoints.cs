using Context.Entities;
using Service;
using Service.Services;
using System.Text.RegularExpressions;

namespace Api.Endpoints;

public static partial class AdminEndpoints
{
    public static RouteGroupBuilder MapAdminEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/admins").WithTags("Admins");
        group.MapGet("/", async (IEntityService<Admin> service, CancellationToken ct) =>
            Results.Ok((await service.GetAllAsync(ct)).Select(ToResponse)));
        group.MapGet("/{id:int}", async (int id, IEntityService<Admin> service, CancellationToken ct) =>
            await service.GetByIdAsync([id], ct) is { } item ? Results.Ok(ToResponse(item)) : Results.NotFound());
        group.MapPost("/", async (CreateAdminRequest request, AuthService auth, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(request.Username) || request.Username.Trim().Length < 3)
                return Results.BadRequest(new { message = "Username must contain at least 3 characters." });
            if (!EmailPattern().IsMatch(request.Email ?? string.Empty))
                return Results.BadRequest(new { message = "Enter a valid email address." });
            if (!AuthService.IsStrongPassword(request.Password ?? string.Empty))
                return Results.BadRequest(new { message = "Password must be at least 8 characters and include uppercase, lowercase, number, and special characters." });

            var result = await auth.CreateAdminAsync(
                new CreateAdminUser(request.Username, request.Email!, request.Password!), ct);
            return result switch
            {
                CreateAdminResult.DuplicateUsername => Results.Conflict(new { message = "This Username already exists. Enter a different Username" }),
                CreateAdminResult.DuplicateEmail => Results.Conflict(new { message = "This email already exists. Enter a different email." }),
                _ => Results.Created("/api/admins", new { message = "Administrator created successfully." })
            };
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
    [GeneratedRegex(@"^[^\s@]+@[^\s@]+\.[^\s@]+$", RegexOptions.IgnoreCase)]
    private static partial Regex EmailPattern();

    public sealed record CreateAdminRequest(string Username, string Email, string Password);
    public sealed record AdminRequest(string Name, string Email, string PasswordHash);
    public sealed record AdminResponse(int Id, string Name, string Email);
}
