using System.Security.Claims;
using Context.Entities;
using Service.Services;

namespace Api.Endpoints;

public static class SurveyEndpoints
{
    public static RouteGroupBuilder MapSurveyEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/survey").WithTags("Survey");
        group.MapGet("/status", GetStatusAsync);
        group.MapPost("/submit", SubmitAsync);
        return group;
    }

    private static async Task<IResult> GetStatusAsync(ClaimsPrincipal principal, ISurveyService service)
    {
        if (!TryGetUserId(principal, out var annotatorId)) return Results.Unauthorized();
        try
        {
            return Results.Ok(new { hasCompletedSurvey = await service.HasCompletedSurveyAsync(annotatorId) });
        }
        catch (InvalidOperationException exception)
        {
            return Results.NotFound(new { message = exception.Message });
        }
    }

    private static async Task<IResult> SubmitAsync(ClaimsPrincipal principal, AnnotatorSurvey survey, ISurveyService service)
    {
        if (!TryGetUserId(principal, out var annotatorId)) return Results.Unauthorized();
        try
        {
            await service.SubmitSurveyAsync(annotatorId, survey);
            return Results.Ok(new { hasCompletedSurvey = true, message = "Survey submitted successfully." });
        }
        catch (ArgumentException exception)
        {
            return Results.BadRequest(new { message = exception.Message });
        }
        catch (InvalidOperationException exception)
        {
            return Results.Conflict(new { message = exception.Message });
        }
    }

    private static bool TryGetUserId(ClaimsPrincipal principal, out int userId) =>
        int.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out userId);
}
