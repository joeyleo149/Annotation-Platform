using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.IdentityModel.Tokens;
using Service.Services;

namespace Api.Endpoints;

public static partial class AuthEndpoints
{
    public static RouteGroupBuilder MapAuthEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/auth").WithTags("Authentication");

        group.MapPost("/register", async (RegisterRequest request, AuthService auth, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(request.Username) || request.Username.Trim().Length < 3)
                return Results.BadRequest(new { message = "Username must contain at least 3 characters." });
            if (!EmailPattern().IsMatch(request.Email ?? string.Empty))
                return Results.BadRequest(new { message = "Enter a valid email address." });
            if (!AuthService.IsStrongPassword(request.Password ?? string.Empty))
                return Results.BadRequest(new { message = "Password must be at least 8 characters and include uppercase, lowercase, number, and special characters." });
            if (request.Gender is not ("Male" or "Female"))
                return Results.BadRequest(new { message = "Gender must be either Male or Female." });
            if (string.IsNullOrWhiteSpace(request.Nationality))
                return Results.BadRequest(new { message = "Nationality is required." });
            if (request.DateOfBirth >= DateOnly.FromDateTime(DateTime.UtcNow))
                return Results.BadRequest(new { message = "Enter a valid date of birth." });

            var result = await auth.RegisterAnnotatorAsync(
                new RegisterUser(request.Username, request.Email!, request.Password!, request.Gender, request.Nationality, request.DateOfBirth), ct);
            return result switch
            {
                RegisterResult.DuplicateUsername => Results.Conflict(new { message = "This Username already exists. Enter a different Username" }),
                RegisterResult.DuplicateEmail => Results.Conflict(new { message = "This email already exists. Enter a different email." }),
                _ => Results.Created("/api/auth/login", new { message = "Account created successfully." })
            };
        });

        group.MapPost("/login", async (LoginRequest request, AuthService auth, IConfiguration config, CancellationToken ct) =>
        {
            var user = await auth.AuthenticateAsync(request.Username, request.Password, ct);
            if (user is null) return Results.Json(new { message = "Invalid username or password." }, statusCode: StatusCodes.Status401Unauthorized);

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Key"]!));
            var token = new JwtSecurityToken(
                issuer: config["Jwt:Issuer"], audience: config["Jwt:Audience"],
                claims:
                [
                    new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                    new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                    new Claim(JwtRegisteredClaimNames.Email, user.Email),
                    new Claim(ClaimTypes.Email, user.Email),
                    new Claim(ClaimTypes.Name, user.Username),
                    new Claim(ClaimTypes.Role, user.Role)
                ],
                expires: DateTime.UtcNow.AddHours(8), signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));
            return Results.Ok(new { token = new JwtSecurityTokenHandler().WriteToken(token), userId = user.Id, email = user.Email, role = user.Role });
        });

        group.MapGet("/profile", async (ClaimsPrincipal principal, AuthService auth, CancellationToken ct) =>
{
    var userIdClaim = principal.FindFirstValue(ClaimTypes.NameIdentifier);
    var roleClaim = principal.FindFirstValue(ClaimTypes.Role);

    if (userIdClaim is null || roleClaim is null || !int.TryParse(userIdClaim, out var userId))
        return Results.Unauthorized();

    var profile = await auth.GetProfileAsync(userId, roleClaim, ct);
    if (profile is null) return Results.NotFound(new { message = "User account not found." });

    return Results.Ok(profile);
});




group.MapPatch("/profile", async (ClaimsPrincipal principal, UpdateProfilePayload payload, AuthService auth, CancellationToken ct) =>
{
    var userIdClaim = principal.FindFirstValue(ClaimTypes.NameIdentifier);
    var roleClaim = principal.FindFirstValue(ClaimTypes.Role);

    if (userIdClaim is null || roleClaim is null || !int.TryParse(userIdClaim, out var userId))
        return Results.Unauthorized();

    if (string.IsNullOrWhiteSpace(payload.Username) || payload.Username.Trim().Length < 3)
        return Results.BadRequest(new { message = "Username must contain at least 3 characters." });
    if (string.IsNullOrWhiteSpace(payload.Email))
        return Results.BadRequest(new { message = "Email is required." });
    if (!string.IsNullOrWhiteSpace(payload.Password) && !AuthService.IsStrongPassword(payload.Password))
        return Results.BadRequest(new { message = "New password must be at least 8 characters and include uppercase, lowercase, number, and special characters." });

    var result = await auth.UpdateProfileAsync(userId, roleClaim, payload, ct);
    return result switch
    {
        UpdateProfileResult.UserNotFound => Results.NotFound(new { message = "User account not found." }),
        UpdateProfileResult.DuplicateUsername => Results.Conflict(new { message = "This Username already exists. Enter a different Username" }),
        UpdateProfileResult.DuplicateEmail => Results.Conflict(new { message = "This email already exists. Enter a different email." }),
        _ => Results.Ok(new { message = "Profile updated successfully." })
    };
});


        return group;
    }

    [GeneratedRegex(@"^[^\s@]+@[^\s@]+\.[^\s@]+$", RegexOptions.IgnoreCase)]
    private static partial Regex EmailPattern();

    public sealed record RegisterRequest(string Username, string Email, string Password, string Gender, string Nationality, DateOnly DateOfBirth);
    public sealed record LoginRequest(string Username, string Password);
}
