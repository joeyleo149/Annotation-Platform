using System.Net;
using System.Net.Mail;

namespace Api.Services;

public sealed class PasswordResetEmailSender(IConfiguration configuration)
{
    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(configuration["Smtp:Host"]) &&
        int.TryParse(configuration["Smtp:Port"], out _) &&
        !string.IsNullOrWhiteSpace(configuration["Smtp:Username"]) &&
        !string.IsNullOrWhiteSpace(configuration["Smtp:Password"]) &&
        !string.IsNullOrWhiteSpace(configuration["Smtp:FromEmail"]);

    public async Task SendOtpAsync(string email, string username, string otp, CancellationToken ct)
    {
        if (!IsConfigured) throw new InvalidOperationException("SMTP email delivery is not configured.");
        using var message = new MailMessage
        {
            From = new MailAddress(configuration["Smtp:FromEmail"]!, configuration["Smtp:FromName"] ?? "Annotate Pro"),
            Subject = "Your Annotate Pro password reset code",
            Body = $"""
                Hello {username},

                Your password reset code is: {otp}

                This code expires in 10 minutes and can be used only once.
                If you did not request a password reset, ignore this email.

                Annotate Pro
                """,
            IsBodyHtml = false
        };
        message.To.Add(new MailAddress(email));
        var useSsl = !bool.TryParse(configuration["Smtp:UseSsl"], out var configuredSsl) || configuredSsl;
        using var client = new SmtpClient(configuration["Smtp:Host"]!, int.Parse(configuration["Smtp:Port"]!))
        {
            EnableSsl = useSsl,
            UseDefaultCredentials = false,
            Credentials = new NetworkCredential(configuration["Smtp:Username"]!, configuration["Smtp:Password"]!)
        };
        await client.SendMailAsync(message, ct);
    }
}
