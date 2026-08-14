using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Service.Services;

namespace Api.BackgroundServices;

public sealed class AssignmentExpirationWorker(
    IServiceScopeFactory scopeFactory,
    IConfiguration configuration,
    ILogger<AssignmentExpirationWorker> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(
        CancellationToken stoppingToken)
    {
        var intervalSeconds =
            configuration.GetValue<int>(
                "AssignmentProcessing:CheckIntervalSeconds",
                60);

        var reassignmentDurationDays =
            configuration.GetValue<int>(
                "AssignmentProcessing:DefaultAssignmentDurationDays",
                1);

        intervalSeconds = Math.Max(10, intervalSeconds);

        reassignmentDurationDays = Math.Clamp(
            reassignmentDurationDays,
            1,
            365);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();

                var assignmentService =
                    scope.ServiceProvider.GetRequiredService<
                        AnnotationAssignmentService>();

                var result =
                    await assignmentService
                        .ProcessExpiredAssignmentsAsync(
                            reassignmentDurationDays,
                            stoppingToken);

                if (result.ExpiredSessionCount > 0)
                {
                    logger.LogInformation(
                        "Expired {ExpiredCount} sessions " +
                        "and reassigned {ReassignedCount}.",
                        result.ExpiredSessionCount,
                        result.ReassignedSessionCount);
                }
            }
            catch (OperationCanceledException)
                when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                logger.LogError(
                    exception,
                    "Assignment expiration processing failed.");
            }

            await Task.Delay(
                TimeSpan.FromSeconds(intervalSeconds),
                stoppingToken);
        }
    }
}