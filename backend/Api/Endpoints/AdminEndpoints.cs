using Api.Services;
using Context.Entities;
using Service;
using Service.Services;
using System.Text.RegularExpressions;

namespace Api.Endpoints;

public static partial class AdminEndpoints
{
    public static RouteGroupBuilder MapAdminEndpoints(
        this IEndpointRouteBuilder routes)
    {
        var group = routes
            .MapGroup("/api/admins")
            .WithTags("Admins");

        group.MapGet(
            "/",
            async (
                IEntityService<Admin> service,
                CancellationToken ct) =>
            {
                var admins =
                    await service.GetAllAsync(ct);

                return Results.Ok(
                    admins.Select(ToResponse));
            });

        group.MapGet(
            "/{id:int}",
            async (
                int id,
                IEntityService<Admin> service,
                CancellationToken ct) =>
            {
                var item =
                    await service.GetByIdAsync(
                        [id],
                        ct);

                return item is not null
                    ? Results.Ok(ToResponse(item))
                    : Results.NotFound();
            });

        group.MapPost(
            "/",
            async (
                CreateAdminRequest request,
                AuthService auth,
                AdminInvitationEmailSender emailSender,
                ILoggerFactory loggerFactory,
                CancellationToken ct) =>
            {
                if (
                    string.IsNullOrWhiteSpace(
                        request.Username) ||
                    request.Username.Trim().Length < 3)
                {
                    return Results.BadRequest(
                        new
                        {
                            message =
                                "Username must contain at least 3 characters.",
                        });
                }

                if (
                    !EmailPattern().IsMatch(
                        request.Email
                        ?? string.Empty))
                {
                    return Results.BadRequest(
                        new
                        {
                            message =
                                "Enter a valid email address.",
                        });
                }

                if (
                    !AuthService.IsStrongPassword(
                        request.Password
                        ?? string.Empty))
                {
                    return Results.BadRequest(
                        new
                        {
                            message =
                                "Password must be at least 8 characters and include uppercase, lowercase, number, and special characters.",
                        });
                }

                if (!emailSender.IsConfigured)
                {
                    return Results.Problem(
                        statusCode:
                            StatusCodes
                                .Status503ServiceUnavailable,
                        title:
                            "Email delivery is not configured.",
                        detail:
                            "Configure the Smtp settings before creating administrators.");
                }

                var result =
                    await auth.CreateAdminAsync(
                        new CreateAdminUser(
                            request.Username,
                            request.Email!,
                            request.Password!),
                        ct);

                if (
                    result ==
                    CreateAdminResult.DuplicateUsername)
                {
                    return Results.Conflict(
                        new
                        {
                            message =
                                "This username already exists. Enter a different username.",
                        });
                }

                if (
                    result ==
                    CreateAdminResult.DuplicateEmail)
                {
                    return Results.Conflict(
                        new
                        {
                            message =
                                "This email already exists. Enter a different email.",
                        });
                }

                try
                {
                    await emailSender.SendCredentialsAsync(
                        request.Email!,
                        request.Username.Trim(),
                        request.Password!,
                        ct);

                    return Results.Created(
                        "/api/admins",
                        new
                        {
                            message =
                                "Administrator created successfully. Login credentials were emailed to the new administrator.",
                        });
                }
                catch (Exception exception)
                {
                    var logger =
                        loggerFactory.CreateLogger(
                            "AdminInvitationEmail");

                    logger.LogError(
                        exception,
                        "Failed to send administrator credentials to {Email}.",
                        request.Email);

                    /*
                     * Remove the newly created administrator
                     * if their credentials could not be sent.
                     */
                    await auth.DeleteAdminByEmailAsync(
                        request.Email!,
                        ct);

                    return Results.Problem(
                        statusCode:
                            StatusCodes
                                .Status502BadGateway,
                        title:
                            "The invitation email could not be sent.",
                        detail:
                            "No administrator account was created. Check the SMTP configuration and try again.");
                }
            });

        group.MapPut(
            "/{id:int}",
            async (
                int id,
                AdminRequest request,
                IEntityService<Admin> service,
                CancellationToken ct) =>
            {
                var item =
                    await service.GetByIdAsync(
                        [id],
                        ct);

                if (item is null)
                {
                    return Results.NotFound();
                }

                item.Name = request.Name;
                item.Email = request.Email;
                item.PasswordHash =
                    request.PasswordHash;

                await service.UpdateAsync(
                    item,
                    ct);

                return Results.Ok(
                    ToResponse(item));
            });

        group.MapDelete(
            "/{id:int}",
            async (
                int id,
                IEntityService<Admin> service,
                CancellationToken ct) =>
            {
                var deleted =
                    await service.DeleteAsync(
                        [id],
                        ct);

                return deleted
                    ? Results.NoContent()
                    : Results.NotFound();
            });

        return group;
    }

    private static AdminResponse ToResponse(
        Admin item)
    {
        return new AdminResponse(
            item.Id,
            item.Name,
            item.Email);
    }

    [GeneratedRegex(
        @"^[^\s@]+@[^\s@]+\.[^\s@]+$",
        RegexOptions.IgnoreCase)]
    private static partial Regex EmailPattern();

    public sealed record CreateAdminRequest(
        string Username,
        string Email,
        string Password);

    public sealed record AdminRequest(
        string Name,
        string Email,
        string PasswordHash);

    public sealed record AdminResponse(
        int Id,
        string Name,
        string Email);
}