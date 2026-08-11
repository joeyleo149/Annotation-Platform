using Context;
using Context.Entities;

namespace Service.Services;

public sealed class QuestionAnswerService(AppDbContext context) : EntityService<QuestionAnswer>(context);
