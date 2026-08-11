using Context;
using Context.Entities;

namespace Service.Services;

public sealed class VideoService(AppDbContext context) : EntityService<Video>(context);
