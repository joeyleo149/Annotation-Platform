using Service.Services;
using System.Security.Claims;

namespace Api.Endpoints;

public static class AnnotationSessionEndpoints
{
    public static RouteGroupBuilder
        MapAnnotationSessionEndpoints(
            this IEndpointRouteBuilder routes)
    {
        var group = routes
            .MapGroup("/api/annotation-sessions")
            .WithTags("Annotation Sessions");

        group.MapGet("/", GetSessionsAsync);
        group.MapGet("/mine", GetMySessionsAsync).RequireAuthorization(policy => policy.RequireRole("Annotator"));
        group.MapGet("/{id:int}", GetSessionAsync);
        group.MapPost("/{id:int}/complete", CompleteSessionAsync).RequireAuthorization(policy => policy.RequireRole("Annotator"));
        group.MapGet("/requests", GetRequestsAsync);
        group.MapPost("/requests", CreateRequestAsync);
        group.MapDelete(
            "/requests/{requestId:int}",
            CancelRequestAsync);
        group.MapPost("/assign-next", AssignNextAsync);
        group.MapPost(
            "/process-expired",
            ProcessExpiredAsync);

        return group;
    }

    private static async Task<IResult> GetSessionsAsync(
        AnnotationAssignmentService assignmentService,
        CancellationToken cancellationToken)
    {
        var sessions =
            await assignmentService.GetSessionsAsync(
                cancellationToken);

        return Results.Ok(sessions);
    }

    private static async Task<IResult> GetMySessionsAsync(
        ClaimsPrincipal principal,
        AnnotationAssignmentService assignmentService,
        CancellationToken cancellationToken)
    {
        if (!int.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var annotatorId))
        {
            return Results.Unauthorized();
        }

        return Results.Ok(await assignmentService.GetSessionsForAnnotatorAsync(annotatorId, cancellationToken));
    }

    private static async Task<IResult> GetSessionAsync(
        int id,
        AnnotationAssignmentService assignmentService,
        CancellationToken cancellationToken)
    {
        var session =
            await assignmentService.GetSessionAsync(
                id,
                cancellationToken);

        return session is null
            ? Results.NotFound(new
            {
                message =
                    $"Annotation session {id} does not exist."
            })
            : Results.Ok(session);
    }

    private static async Task<IResult> CompleteSessionAsync(
        int id,
        AnnotationAssignmentService assignmentService,
        CancellationToken cancellationToken)
    {
        var result = await assignmentService.CompleteSessionAsync(id, cancellationToken);

        return result.Success
            ? Results.Ok(new { message = result.Message })
            : Results.BadRequest(new { message = result.Message });
    }

    private static async Task<IResult> GetRequestsAsync(
        int? datasetId,
        string? status,
        AnnotationAssignmentService assignmentService,
        CancellationToken cancellationToken)
    {
        var requests =
            await assignmentService.GetRequestsAsync(
                datasetId,
                status,
                cancellationToken);

        return Results.Ok(requests);
    }

    private static async Task<IResult> CreateRequestAsync(
        CreateTaskRequest request,
        AnnotationAssignmentService assignmentService,
        CancellationToken cancellationToken)
    {
        try
        {
            var result =
                await assignmentService.CreateRequestAsync(
                    request.AnnotatorId,
                    request.DatasetId,
                    cancellationToken);

            return Results.Created(
                $"/api/annotation-sessions/requests/{result.Id}",
                result);
        }
        catch (ArgumentException exception)
        {
            return Results.BadRequest(new
            {
                message = exception.Message
            });
        }
        catch (KeyNotFoundException exception)
        {
            return Results.NotFound(new
            {
                message = exception.Message
            });
        }
        catch (TaskRequestConflictException exception)
        {
            return Results.Conflict(new
            {
                message = exception.Message
            });
        }
    }

    private static async Task<IResult> CancelRequestAsync(
        int requestId,
        AnnotationAssignmentService assignmentService,
        CancellationToken cancellationToken)
    {
        var cancelled =
            await assignmentService.CancelRequestAsync(
                requestId,
                cancellationToken);

        return cancelled
            ? Results.Ok(new
            {
                message =
                    "The waiting request was cancelled."
            })
            : Results.NotFound(new
            {
                message =
                    "A waiting request with that ID was not found."
            });
    }

    private static async Task<IResult> AssignNextAsync(
        AssignNextRequest request,
        AnnotationAssignmentService assignmentService,
        CancellationToken cancellationToken)
    {
        try
        {
            var outcome =
                await assignmentService.AssignNextAsync(
                    request.DatasetId,
                    request.AssignmentDurationDays,
                    cancellationToken);

            return outcome.Assigned
                ? Results.Ok(outcome)
                : Results.Conflict(outcome);
        }
        catch (ArgumentException exception)
        {
            return Results.BadRequest(new
            {
                message = exception.Message
            });
        }
        catch (KeyNotFoundException exception)
        {
            return Results.NotFound(new
            {
                message = exception.Message
            });
        }
        catch (TaskRequestConflictException exception)
        {
            return Results.Conflict(new
            {
                message = exception.Message
            });
        }
    }

    private static async Task<IResult> ProcessExpiredAsync(
        AnnotationAssignmentService assignmentService,
        IConfiguration configuration,
        CancellationToken cancellationToken)
    {
        var reassignmentDurationDays =
            configuration.GetValue<int>(
                "AssignmentProcessing:" +
                "DefaultAssignmentDurationDays",
                1);

        try
        {
            var result =
                await assignmentService
                    .ProcessExpiredAssignmentsAsync(
                        reassignmentDurationDays,
                        cancellationToken);

            return Results.Ok(result);
        }
        catch (ArgumentException exception)
        {
            return Results.BadRequest(new
            {
                message = exception.Message
            });
        }
    }
}

public sealed record CreateTaskRequest(
    int AnnotatorId,
    int DatasetId);

public sealed record AssignNextRequest(
    int DatasetId,
    int AssignmentDurationDays);
