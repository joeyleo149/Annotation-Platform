using Context;
using Context.Entities;

namespace Service.Services;

public sealed class AdminService(AppDbContext context) : EntityService<Admin>(context);
