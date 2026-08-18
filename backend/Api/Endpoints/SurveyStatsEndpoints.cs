using System.Security.Claims;
using Service.Services;

namespace Api.Endpoints;

public static class SurveyStatsEndpoints
{
    public static RouteGroupBuilder MapSurveyStatsEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/admin/survey-stats")
            .WithTags("SurveyStatistics");

       
        group.MapGet("", GetStatsAsync); 
        return group;
    }

    private static async Task<IResult> GetStatsAsync(ClaimsPrincipal principal, ISurveyStatsService service)
    {
        if (!principal.Identity?.IsAuthenticated ?? true) return Results.Unauthorized();
        if (!principal.IsInRole("Admin") && principal.FindFirstValue(ClaimTypes.Role) != "Admin") 
            return Results.Forbid();

        var stats = await service.GetOverallStatsAsync();
        return Results.Ok(stats);
    }
}