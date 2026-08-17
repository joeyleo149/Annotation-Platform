using System.Security.Cryptography;
using Context;
using Context.Entities;
using Microsoft.EntityFrameworkCore;

namespace Service.Services;

public sealed class AuthService(
    AppDbContext context)
{
    private const int Iterations = 120_000;
    private const int SaltSize = 16;
    private const int HashSize = 32;

    public async Task<AuthUser?> AuthenticateAsync(
        string username,
        string password,
        CancellationToken ct)
    {
        var normalized = username.Trim();

        var admin =
            await context.Admins
                .AsNoTracking()
                .SingleOrDefaultAsync(
                    item =>
                        item.Name == normalized,
                    ct);

        if (
            admin is not null &&
            VerifyPassword(
                password,
                admin.PasswordHash))
        {
            return new AuthUser(
                admin.Id,
                admin.Name,
                admin.Email,
                "Admin");
        }

        var annotator =
            await context.Annotators
                .AsNoTracking()
                .SingleOrDefaultAsync(
                    item =>
                        item.Name == normalized,
                    ct);

        if (
            annotator is not null &&
            VerifyPassword(
                password,
                annotator.PasswordHash))
        {
            return new AuthUser(
                annotator.Id,
                annotator.Name,
                annotator.Email,
                "Annotator");
        }

        return null;
    }

    public async Task<RegisterResult>
        RegisterAnnotatorAsync(
            RegisterUser request,
            CancellationToken ct)
    {
        var username =
            request.Username.Trim();

        var usernameExists =
            await context.Admins.AnyAsync(
                item =>
                    item.Name == username,
                ct)
            ||
            await context.Annotators.AnyAsync(
                item =>
                    item.Name == username,
                ct);

        if (usernameExists)
        {
            return RegisterResult
                .DuplicateUsername;
        }

        var email =
            request.Email
                .Trim()
                .ToLowerInvariant();

        var emailExists =
            await context.Admins.AnyAsync(
                item =>
                    item.Email == email,
                ct)
            ||
            await context.Annotators.AnyAsync(
                item =>
                    item.Email == email,
                ct);

        if (emailExists)
        {
            return RegisterResult
                .DuplicateEmail;
        }

        context.Annotators.Add(
            new Annotator
            {
                Name = username,
                Email = email,
                PasswordHash =
                    HashPassword(
                        request.Password),
                Gender =
                    request.Gender.Trim(),
                Nationality =
                    request.Nationality.Trim(),
                DateOfBirth =
                    request.DateOfBirth,
            });

        await context.SaveChangesAsync(ct);

        return RegisterResult.Success;
    }

    public async Task<CreateAdminResult>
        CreateAdminAsync(
            CreateAdminUser request,
            CancellationToken ct)
    {
        var username =
            request.Username.Trim();

        var usernameExists =
            await context.Admins.AnyAsync(
                item =>
                    item.Name == username,
                ct)
            ||
            await context.Annotators.AnyAsync(
                item =>
                    item.Name == username,
                ct);

        if (usernameExists)
        {
            return CreateAdminResult
                .DuplicateUsername;
        }

        var email =
            request.Email
                .Trim()
                .ToLowerInvariant();

        var emailExists =
            await context.Admins.AnyAsync(
                item =>
                    item.Email == email,
                ct)
            ||
            await context.Annotators.AnyAsync(
                item =>
                    item.Email == email,
                ct);

        if (emailExists)
        {
            return CreateAdminResult
                .DuplicateEmail;
        }

        context.Admins.Add(
            new Admin
            {
                Name = username,
                Email = email,
                PasswordHash =
                    HashPassword(
                        request.Password),
            });

        await context.SaveChangesAsync(ct);

        return CreateAdminResult.Success;
    }

    public async Task DeleteAdminByEmailAsync(
        string email,
        CancellationToken ct)
    {
        var normalizedEmail =
            email.Trim().ToLowerInvariant();

        var admin =
            await context.Admins
                .SingleOrDefaultAsync(
                    item =>
                        item.Email ==
                        normalizedEmail,
                    ct);

        if (admin is null)
        {
            return;
        }

        context.Admins.Remove(admin);

        await context.SaveChangesAsync(ct);
    }

    public static bool IsStrongPassword(
        string password)
    {
        return
            password.Length >= 8 &&
            password.Any(char.IsUpper) &&
            password.Any(char.IsLower) &&
            password.Any(char.IsDigit) &&
            password.Any(
                character =>
                    !char.IsLetterOrDigit(
                        character));
    }

    private static string HashPassword(
        string password)
    {
        var salt =
            RandomNumberGenerator.GetBytes(
                SaltSize);

        var hash =
            Rfc2898DeriveBytes.Pbkdf2(
                password,
                salt,
                Iterations,
                HashAlgorithmName.SHA256,
                HashSize);

        return
            $"pbkdf2-sha256${Iterations}" +
            $"${Convert.ToBase64String(salt)}" +
            $"${Convert.ToBase64String(hash)}";
    }

    private static bool VerifyPassword(
        string password,
        string encoded)
    {
        var parts = encoded.Split('$');

        if (
            parts.Length != 4 ||
            parts[0] != "pbkdf2-sha256" ||
            !int.TryParse(
                parts[1],
                out var iterations))
        {
            return false;
        }

        try
        {
            var salt =
                Convert.FromBase64String(
                    parts[2]);

            var expected =
                Convert.FromBase64String(
                    parts[3]);

            var actual =
                Rfc2898DeriveBytes.Pbkdf2(
                    password,
                    salt,
                    iterations,
                    HashAlgorithmName.SHA256,
                    expected.Length);

            return CryptographicOperations
                .FixedTimeEquals(
                    actual,
                    expected);
        }
        catch (FormatException)
        {
            return false;
        }
    }
}

public sealed record AuthUser(
    int Id,
    string Username,
    string Email,
    string Role);

public sealed record RegisterUser(
    string Username,
    string Email,
    string Password,
    string Gender,
    string Nationality,
    DateOnly DateOfBirth);

public sealed record CreateAdminUser(
    string Username,
    string Email,
    string Password);

public enum RegisterResult
{
    Success,
    DuplicateUsername,
    DuplicateEmail,
}

public enum CreateAdminResult
{
    Success,
    DuplicateUsername,
    DuplicateEmail,
}