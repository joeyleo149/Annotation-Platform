using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.IdentityModel.Tokens;
using Service.Services;
using Api.Services;

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

        group.MapPost("/forgot-password", async (
            ForgotPasswordRequest request,
            AuthService auth,
            PasswordResetOtpService otpService,
            PasswordResetEmailSender emailSender,
            CancellationToken ct) =>
        {
            if (!EmailPattern().IsMatch(request.Email ?? string.Empty))
                return Results.BadRequest(new { message = "Enter a valid email address." });

            const string genericMessage = "If an account uses this email, a reset code has been sent.";
            var user = await auth.FindUserByEmailAsync(request.Email!, ct);
            if (user is null) return Results.Ok(new { message = genericMessage });
            if (!emailSender.IsConfigured)
                return Results.Json(new { message = "Password reset email is not configured. Contact an administrator." }, statusCode: 503);

            var otp = otpService.Create(user.Email);
            if (!otp.Created)
                return Results.Json(new { message = "Please wait one minute before requesting another code." }, statusCode: 429);

            try
            {
                await emailSender.SendOtpAsync(user.Email, user.Username, otp.Code!, ct);
            }
            catch
            {
                otpService.Remove(user.Email);
                return Results.Json(new { message = "The reset email could not be sent. Please try again later." }, statusCode: 503);
            }

            return Results.Ok(new { message = genericMessage });
        });

        group.MapPost("/reset-password", async (
            ResetPasswordRequest request,
            AuthService auth,
            PasswordResetOtpService otpService,
            CancellationToken ct) =>
        {
            if (!EmailPattern().IsMatch(request.Email ?? string.Empty))
                return Results.BadRequest(new { message = "Enter a valid email address." });
            if (!Regex.IsMatch(request.Otp ?? string.Empty, @"^\d{6}$"))
                return Results.BadRequest(new { message = "Enter the six-digit reset code." });
            if (!AuthService.IsStrongPassword(request.NewPassword ?? string.Empty))
                return Results.BadRequest(new { message = "Password must be at least 8 characters and include uppercase, lowercase, number, and special characters." });

            var validation = otpService.Validate(request.Email!, request.Otp!);
            if (validation != OtpValidationResult.Valid)
            {
                var message = validation switch
                {
                    OtpValidationResult.Expired => "The reset code has expired. Request a new code.",
                    OtpValidationResult.TooManyAttempts => "Too many incorrect attempts. Request a new code.",
                    _ => "The reset code is incorrect."
                };
                return Results.BadRequest(new { message });
            }

            var reset = await auth.ResetPasswordByEmailAsync(request.Email!, request.NewPassword!, ct);
            otpService.Consume(request.Email!);
            if (reset)
                return Results.Ok(new { message = "Password reset successfully. You can now log in." });
            return Results.BadRequest(new { message = "The reset request is no longer valid." });
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

        group.MapDelete("/account", async (ClaimsPrincipal principal, AuthService auth, CancellationToken ct) =>
        {
            var userIdClaim = principal.FindFirstValue(ClaimTypes.NameIdentifier);
            var roleClaim = principal.FindFirstValue(ClaimTypes.Role);

            if (userIdClaim is null || roleClaim is null || !int.TryParse(userIdClaim, out var userId))
                return Results.Unauthorized();

            var result = await auth.DeleteAccountAsync(userId, roleClaim, ct);
            return result switch
            {
                DeleteAccountResult.UserNotFound => Results.NotFound(new { message = "User account not found." }),
                _ => Results.Ok(new { message = "Your account was deleted. Your past annotations remain in the system." })
            };
        }).RequireAuthorization();


        return group;
    }

    [GeneratedRegex(@"^[^\s@]+@[^\s@]+\.[^\s@]+$", RegexOptions.IgnoreCase)]
    private static partial Regex EmailPattern();

    public sealed record RegisterRequest(string Username, string Email, string Password, string Gender, string Nationality, DateOnly DateOfBirth);
    public sealed record LoginRequest(string Username, string Password);
    public sealed record ForgotPasswordRequest(string Email);
    public sealed record ResetPasswordRequest(string Email, string Otp, string NewPassword);
}
