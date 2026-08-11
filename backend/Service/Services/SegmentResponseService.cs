using Context;
using Context.Entities;

namespace Service.Services;

public sealed class SegmentResponseService(AppDbContext context) : EntityService<SegmentResponse>(context);
