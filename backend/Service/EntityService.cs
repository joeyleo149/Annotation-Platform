using Context;
using Microsoft.EntityFrameworkCore;

namespace Service;

public abstract class EntityService<T>(AppDbContext dbContext) : IEntityService<T> where T : class
{
    protected DbSet<T> Entities => dbContext.Set<T>();

    public async Task<IReadOnlyList<T>> GetAllAsync(CancellationToken cancellationToken = default) =>
        await Entities.AsNoTracking().ToListAsync(cancellationToken);

    public async Task<T?> GetByIdAsync(object[] keyValues, CancellationToken cancellationToken = default) =>
        await Entities.FindAsync(keyValues, cancellationToken);

    public async Task<T> CreateAsync(T entity, CancellationToken cancellationToken = default)
    {
        Entities.Add(entity);
        await dbContext.SaveChangesAsync(cancellationToken);
        return entity;
    }

    public async Task<T> UpdateAsync(T entity, CancellationToken cancellationToken = default)
    {
        Entities.Update(entity);
        await dbContext.SaveChangesAsync(cancellationToken);
        return entity;
    }

    public async Task<bool> DeleteAsync(object[] keyValues, CancellationToken cancellationToken = default)
    {
        var entity = await Entities.FindAsync(keyValues, cancellationToken);
        if (entity is null) return false;
        Entities.Remove(entity);
        await dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}
