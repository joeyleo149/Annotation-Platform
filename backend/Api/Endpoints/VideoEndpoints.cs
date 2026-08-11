using Context.Entities;
using Service;

namespace Api.Endpoints;

public static class VideoEndpoints
{
    public static RouteGroupBuilder MapVideoEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/videos").WithTags("Videos");
        group.MapGet("/", async (IEntityService<Video> service, CancellationToken ct) => Results.Ok((await service.GetAllAsync(ct)).Select(ToResponse)));
        group.MapGet("/{id:int}", async (int id, IEntityService<Video> service, CancellationToken ct) => await service.GetByIdAsync([id], ct) is { } x ? Results.Ok(ToResponse(x)) : Results.NotFound());
        group.MapPost("/", async (VideoRequest r, IEntityService<Video> service, CancellationToken ct) =>
        {
            var x = await service.CreateAsync(new Video { FileName = r.FileName, StoragePath = r.StoragePath, UploadedByAdminId = r.UploadedByAdminId, UploadedAt = r.UploadedAt }, ct);
            return Results.Created($"/api/videos/{x.Id}", ToResponse(x));
        });
        group.MapPut("/{id:int}", async (int id, VideoRequest r, IEntityService<Video> service, CancellationToken ct) =>
        {
            var x = await service.GetByIdAsync([id], ct); if (x is null) return Results.NotFound();
            x.FileName = r.FileName; x.StoragePath = r.StoragePath; x.UploadedByAdminId = r.UploadedByAdminId; x.UploadedAt = r.UploadedAt;
            await service.UpdateAsync(x, ct); return Results.Ok(ToResponse(x));
        });
        group.MapDelete("/{id:int}", async (int id, IEntityService<Video> service, CancellationToken ct) => await service.DeleteAsync([id], ct) ? Results.NoContent() : Results.NotFound());
        return group;
    }
    private static VideoResponse ToResponse(Video x) => new(x.Id, x.FileName, x.StoragePath, x.UploadedByAdminId, x.UploadedAt);
    public sealed record VideoRequest(string FileName, string StoragePath, int UploadedByAdminId, DateTimeOffset UploadedAt);
    public sealed record VideoResponse(int Id, string FileName, string StoragePath, int UploadedByAdminId, DateTimeOffset UploadedAt);
}
