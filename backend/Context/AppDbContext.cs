using Context.Entities;
using Microsoft.EntityFrameworkCore;

namespace Context;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Admin> Admins => Set<Admin>();
    public DbSet<Annotator> Annotators => Set<Annotator>();
    public DbSet<Video> Videos => Set<Video>();
    public DbSet<AnnotationSession> AnnotationSessions => Set<AnnotationSession>();
    public DbSet<SegmentResponse> SegmentResponses => Set<SegmentResponse>();
    public DbSet<QuestionAnswer> QuestionAnswers => Set<QuestionAnswer>();
    public DbSet<Question> Questions => Set<Question>();
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Admin>(entity =>
        {
            entity.Property(x => x.Name).HasMaxLength(200);
            entity.Property(x => x.Email).HasMaxLength(320);
            entity.Property(x => x.PasswordHash).HasMaxLength(500);
            entity.HasIndex(x => x.Email).IsUnique();
        });
        modelBuilder.Entity<Annotator>(entity =>
        {
            entity.Property(x => x.Name).HasMaxLength(200);
            entity.Property(x => x.Email).HasMaxLength(320);
            entity.Property(x => x.PasswordHash).HasMaxLength(500);
            entity.Property(x => x.Gender).HasMaxLength(50);
            entity.Property(x => x.Nationality).HasMaxLength(100);
            entity.HasIndex(x => x.Email).IsUnique();
        });
        modelBuilder.Entity<Video>(entity =>
        {
            entity.Property(x => x.FileName).HasMaxLength(260);
            entity.Property(x => x.StoragePath).HasMaxLength(2048);
            entity.HasOne(x => x.UploadedByAdmin).WithMany(x => x.UploadedVideos)
                .HasForeignKey(x => x.UploadedByAdminId).OnDelete(DeleteBehavior.Restrict);
        });
        modelBuilder.Entity<AnnotationSession>(entity =>
        {
            entity.HasOne(x => x.Annotator).WithMany(x => x.AnnotationSessions).HasForeignKey(x => x.AnnotatorId);
            entity.HasOne(x => x.Video).WithMany(x => x.AnnotationSessions).HasForeignKey(x => x.VideoId);
        });
        modelBuilder.Entity<SegmentResponse>(entity =>
        {
            entity.Property(x => x.Transcript).HasColumnType("nvarchar(max)");
            entity.HasIndex(x => new { x.AnnotationSessionId, x.SegmentNumber }).IsUnique();
            entity.HasOne(x => x.AnnotationSession).WithMany(x => x.SegmentResponses).HasForeignKey(x => x.AnnotationSessionId);
        });
        modelBuilder.Entity<QuestionAnswer>(entity =>
        {
            entity.HasKey(x => new { x.SegmentResponseId, x.QuestionNumber });
            entity.Property(x => x.Answer).HasColumnType("nvarchar(max)");
            entity.HasOne(x => x.SegmentResponse).WithMany(x => x.QuestionAnswers).HasForeignKey(x => x.SegmentResponseId);
        });

        modelBuilder.Entity<Question>();
    }
}
