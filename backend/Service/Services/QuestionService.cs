using Context;
using Context.Entities;

namespace Service.Services;

public sealed class QuestionService(AppDbContext context) : EntityService<Question>(context);