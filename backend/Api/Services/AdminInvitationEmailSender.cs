using System.Net;
using System.Net.Mail;

namespace Api.Services;

public sealed class AdminInvitationEmailSender(
    IConfiguration configuration)
{
    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(
            configuration["Smtp:Host"]) &&
        int.TryParse(
            configuration["Smtp:Port"],
            out _) &&
        !string.IsNullOrWhiteSpace(
            configuration["Smtp:Username"]) &&
        !string.IsNullOrWhiteSpace(
            configuration["Smtp:Password"]) &&
        !string.IsNullOrWhiteSpace(
            configuration["Smtp:FromEmail"]);

    public async Task SendCredentialsAsync(
        string recipientEmail,
        string username,
        string temporaryPassword,
        CancellationToken cancellationToken)
    {
        if (!IsConfigured)
        {
            throw new InvalidOperationException(
                "SMTP email delivery is not configured.");
        }

        var host =
            configuration["Smtp:Host"]!;

        var port = int.Parse(
            configuration["Smtp:Port"]!);

        var smtpUsername =
            configuration["Smtp:Username"]!;

        var smtpPassword =
            configuration["Smtp:Password"]!;

        var fromEmail =
            configuration["Smtp:FromEmail"]!;

        var fromName =
            configuration["Smtp:FromName"]
            ?? "Annotate Pro";

        var useSsl =
            !bool.TryParse(
                configuration["Smtp:UseSsl"],
                out var configuredSsl)
            || configuredSsl;

        using var message = new MailMessage
        {
            From = new MailAddress(
                fromEmail,
                fromName),

            Subject =
                "Your Annotate Pro administrator account",

            Body = $"""
                Hello {username},

                An administrator account has been created for you in Annotate Pro.

                Username: {username}
                Temporary password: {temporaryPassword}

                Please sign in and keep these credentials secure. Do not forward this email.

                Annotate Pro
                """,

            IsBodyHtml = false,
        };

        message.To.Add(
            new MailAddress(recipientEmail));

        using var client = new SmtpClient(
            host,
            port)
        {
            EnableSsl = useSsl,

            UseDefaultCredentials = false,

            Credentials = new NetworkCredential(
                smtpUsername,
                smtpPassword),
        };

        await client.SendMailAsync(
            message,
            cancellationToken);
    }
}