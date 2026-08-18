using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;

namespace Api.Services;

public sealed class PasswordResetOtpService
{
    private const int MaximumAttempts = 5;
    private static readonly TimeSpan OtpLifetime = TimeSpan.FromMinutes(10);
    private static readonly TimeSpan ResendCooldown = TimeSpan.FromSeconds(60);
    private readonly ConcurrentDictionary<string, OtpEntry> entries = new();

    public OtpCreationResult Create(string email)
    {
        var key = Normalize(email);
        var now = DateTimeOffset.UtcNow;
        if (entries.TryGetValue(key, out var existing) && now - existing.CreatedAt < ResendCooldown)
            return new(false, null);

        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        var salt = RandomNumberGenerator.GetBytes(16);
        entries[key] = new(salt, Hash(code, salt), now, now.Add(OtpLifetime), 0);
        return new(true, code);
    }

    public OtpValidationResult Validate(string email, string code)
    {
        var key = Normalize(email);
        if (!entries.TryGetValue(key, out var entry)) return OtpValidationResult.Invalid;
        if (entry.ExpiresAt <= DateTimeOffset.UtcNow)
        {
            entries.TryRemove(key, out _);
            return OtpValidationResult.Expired;
        }

        if (entry.FailedAttempts >= MaximumAttempts)
        {
            entries.TryRemove(key, out _);
            return OtpValidationResult.TooManyAttempts;
        }

        if (!CryptographicOperations.FixedTimeEquals(Hash(code, entry.Salt), entry.Hash))
        {
            var attempts = entry.FailedAttempts + 1;
            if (attempts >= MaximumAttempts)
            {
                entries.TryRemove(key, out _);
                return OtpValidationResult.TooManyAttempts;
            }
            entries[key] = entry with { FailedAttempts = attempts };
            return OtpValidationResult.Invalid;
        }

        return OtpValidationResult.Valid;
    }

    public void Consume(string email) => entries.TryRemove(Normalize(email), out _);
    public void Remove(string email) => entries.TryRemove(Normalize(email), out _);

    private static byte[] Hash(string code, byte[] salt) =>
        Rfc2898DeriveBytes.Pbkdf2(Encoding.UTF8.GetBytes(code), salt, 100_000, HashAlgorithmName.SHA256, 32);
    private static string Normalize(string email) => email.Trim().ToLowerInvariant();
    private sealed record OtpEntry(byte[] Salt, byte[] Hash, DateTimeOffset CreatedAt, DateTimeOffset ExpiresAt, int FailedAttempts);
}

public sealed record OtpCreationResult(bool Created, string? Code);
public enum OtpValidationResult { Valid, Invalid, Expired, TooManyAttempts }
