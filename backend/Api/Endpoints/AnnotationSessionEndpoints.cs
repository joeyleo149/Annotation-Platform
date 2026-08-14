using Context.Entities;
using Service;

namespace Api.Endpoints;

public static class AnnotationSessionEndpoints
{
    public static RouteGroupBuilder MapAnnotationSessionEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/annotation-sessions").WithTags("Annotation Sessions");

        group.MapGet("/", async (IEntityService<AnnotationSession> service, CancellationToken ct) =>
            Results.Ok((await service.GetAllAsync(ct)).Select(ToResponse)));

        group.MapGet("/{id:int}", async (int id, IEntityService<AnnotationSession> service, CancellationToken ct) =>
            await service.GetByIdAsync([id], ct) is { } x ? Results.Ok(ToResponse(x)) : Results.NotFound());

        // Status is never accepted from the client — new sessions always start as Assigned.
        // It flips to InProgress automatically on first SegmentResponse (see SegmentResponseEndpoints.cs).
        // Completed is a separate, not-yet-built action — not exposed here.
        group.MapPost("/", async (AnnotationSessionRequest r, IEntityService<AnnotationSession> service, CancellationToken ct) =>
        {
            var x = await service.CreateAsync(new AnnotationSession
            {
                AnnotatorId = r.AnnotatorId,
                VideoId = r.VideoId,
                Status = SessionStatus.Assigned,
                AssignedAt = r.AssignedAt,
                ExpiresAt = r.ExpiresAt,
            }, ct);
            return Results.Created($"/api/annotation-sessions/{x.Id}", ToResponse(x));
        });

        // Note: intentionally does not touch Status. Reassigning annotator/video/expiry
        // does not change progress state.
        group.MapPut("/{id:int}", async (int id, AnnotationSessionRequest r, IEntityService<AnnotationSession> service, CancellationToken ct) =>
        {
            var x = await service.GetByIdAsync([id], ct);
            if (x is null) return Results.NotFound();

            x.AnnotatorId = r.AnnotatorId;
            x.VideoId = r.VideoId;
            x.ExpiresAt = r.ExpiresAt;

            await service.UpdateAsync(x, ct);
            return Results.Ok(ToResponse(x));
        });

        group.MapDelete("/{id:int}", async (int id, IEntityService<AnnotationSession> service, CancellationToken ct) =>
            await service.DeleteAsync([id], ct) ? Results.NoContent() : Results.NotFound());

        return group;
    }

    private static AnnotationSessionResponse ToResponse(AnnotationSession x) =>
        new(x.Id, x.AnnotatorId, x.VideoId, x.Status, x.AssignedAt, x.ExpiresAt);

    public sealed record AnnotationSessionRequest(
        int AnnotatorId, int VideoId, DateTimeOffset AssignedAt, DateTimeOffset ExpiresAt);

    public sealed record AnnotationSessionResponse(
        int Id, int AnnotatorId, int VideoId, SessionStatus Status,
        DateTimeOffset AssignedAt, DateTimeOffset ExpiresAt);
}