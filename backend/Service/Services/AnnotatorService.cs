using Context;
using Context.Entities;

namespace Service.Services;

public sealed class AnnotatorService(AppDbContext context) : EntityService<Annotator>(context);
