using Service.Services;
using System.Security.Claims;

namespace Api.Endpoints;

public static class DatasetEndpoints
{
    public static RouteGroupBuilder MapDatasetEndpoints(
        this IEndpointRouteBuilder routes)
    {
        var group = routes
            .MapGroup("/api/datasets")
            .WithTags("Datasets");

        group.MapGet(
            "/",
            GetDatasetsAsync);

        group.MapGet(
            "/available",
            GetAvailableDatasetsAsync)
            .RequireAuthorization(
                policy => policy.RequireRole("Annotator"));

        group.MapPatch(
            "/{datasetId:int}/archive",
            ArchiveDatasetAsync);

        group.MapPatch(
            "/{datasetId:int}/restore",
            RestoreDatasetAsync);

        group.MapPost(
            "/archive-eligible",
            ArchiveEligibleDatasetsAsync);

        return group;
    }

    private static async Task<IResult> GetAvailableDatasetsAsync(
        ClaimsPrincipal principal,
        AnnotationAssignmentService assignmentService,
        CancellationToken cancellationToken)
    {
        if (!int.TryParse(
                principal.FindFirstValue(
                    ClaimTypes.NameIdentifier),
                out var annotatorId) ||
            annotatorId <= 0)
        {
            return Results.Unauthorized();
        }

        var datasets = await assignmentService
            .GetAvailableDatasetsForAnnotatorAsync(
                annotatorId,
                cancellationToken);

        return Results.Ok(datasets);
    }

    private static async Task<IResult> GetDatasetsAsync(
        bool? includeArchived,
        ArchiveService archiveService,
        CancellationToken cancellationToken)
    {
        var datasets =
            await archiveService.GetDatasetsAsync(
                includeArchived ?? false,
                cancellationToken);

        return Results.Ok(datasets);
    }

    private static async Task<IResult> ArchiveDatasetAsync(
        int datasetId,
        ArchiveService archiveService,
        CancellationToken cancellationToken)
    {
        var outcome =
            await archiveService
                .ArchiveDatasetIfCompleteAsync(
                    datasetId,
                    cancellationToken);

        if (!outcome.Found)
        {
            return Results.NotFound(outcome);
        }

        if (!outcome.Archived)
        {
            return Results.Conflict(outcome);
        }

        return Results.Ok(outcome);
    }

    private static async Task<IResult> RestoreDatasetAsync(
        int datasetId,
        ArchiveService archiveService,
        CancellationToken cancellationToken)
    {
        var outcome =
            await archiveService.RestoreDatasetAsync(
                datasetId,
                cancellationToken);

        return outcome.Found
            ? Results.Ok(outcome)
            : Results.NotFound(outcome);
    }

    private static async Task<IResult>
        ArchiveEligibleDatasetsAsync(
            ArchiveService archiveService,
            CancellationToken cancellationToken)
    {
        var result =
            await archiveService
                .ArchiveEligibleDatasetsAsync(
                    cancellationToken);

        return Results.Ok(result);
    }
}
