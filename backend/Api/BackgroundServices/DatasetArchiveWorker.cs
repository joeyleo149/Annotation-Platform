using Service.Services;

namespace Api.BackgroundServices;

public sealed class DatasetArchiveWorker(
    IServiceScopeFactory scopeFactory,
    IConfiguration configuration,
    ILogger<DatasetArchiveWorker> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(
        CancellationToken stoppingToken)
    {
        var intervalSeconds =
            configuration.GetValue<int>(
                "ArchiveProcessing:CheckIntervalSeconds",
                60);

        intervalSeconds =
            Math.Max(10, intervalSeconds);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope =
                    scopeFactory.CreateScope();

                var archiveService =
                    scope.ServiceProvider
                        .GetRequiredService<
                            ArchiveService>();

                var result =
                    await archiveService
                        .ArchiveEligibleDatasetsAsync(
                            stoppingToken);

                if (result.ArchivedDatasetCount > 0)
                {
                    logger.LogInformation(
                        "Automatically archived " +
                        "{DatasetCount} datasets.",
                        result.ArchivedDatasetCount);
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
                    "Automatic dataset archiving failed.");
            }

            await Task.Delay(
                TimeSpan.FromSeconds(intervalSeconds),
                stoppingToken);
        }
    }
}