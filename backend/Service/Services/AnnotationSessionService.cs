using Context;
using Context.Entities;

namespace Service.Services;

public sealed class AnnotationSessionService(AppDbContext context) : EntityService<AnnotationSession>(context);
