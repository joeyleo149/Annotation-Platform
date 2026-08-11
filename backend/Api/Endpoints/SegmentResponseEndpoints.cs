using Context.Entities;
using Service;

namespace Api.Endpoints;

public static class SegmentResponseEndpoints
{
    public static RouteGroupBuilder MapSegmentResponseEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/segment-responses").WithTags("Segment Responses");
        group.MapGet("/", async (IEntityService<SegmentResponse> service, CancellationToken ct) => Results.Ok((await service.GetAllAsync(ct)).Select(ToResponse)));
        group.MapGet("/{id:int}", async (int id, IEntityService<SegmentResponse> service, CancellationToken ct) => await service.GetByIdAsync([id], ct) is { } x ? Results.Ok(ToResponse(x)) : Results.NotFound());
        group.MapPost("/", async (SegmentResponseRequest r, IEntityService<SegmentResponse> service, CancellationToken ct) =>
        {
            var x = await service.CreateAsync(new SegmentResponse { AnnotationSessionId = r.AnnotationSessionId, SegmentNumber = r.SegmentNumber, Transcript = r.Transcript, SubmittedAt = r.SubmittedAt }, ct);
            return Results.Created($"/api/segment-responses/{x.Id}", ToResponse(x));
        });
        group.MapPut("/{id:int}", async (int id, SegmentResponseRequest r, IEntityService<SegmentResponse> service, CancellationToken ct) =>
        {
            var x = await service.GetByIdAsync([id], ct); if (x is null) return Results.NotFound();
            x.AnnotationSessionId = r.AnnotationSessionId; x.SegmentNumber = r.SegmentNumber; x.Transcript = r.Transcript; x.SubmittedAt = r.SubmittedAt;
            await service.UpdateAsync(x, ct); return Results.Ok(ToResponse(x));
        });
        group.MapDelete("/{id:int}", async (int id, IEntityService<SegmentResponse> service, CancellationToken ct) => await service.DeleteAsync([id], ct) ? Results.NoContent() : Results.NotFound());
        return group;
    }
    private static SegmentResponseResponse ToResponse(SegmentResponse x) => new(x.Id, x.AnnotationSessionId, x.SegmentNumber, x.Transcript, x.SubmittedAt);
    public sealed record SegmentResponseRequest(int AnnotationSessionId, int SegmentNumber, string Transcript, DateTimeOffset SubmittedAt);
    public sealed record SegmentResponseResponse(int Id, int AnnotationSessionId, int SegmentNumber, string Transcript, DateTimeOffset SubmittedAt);
}
