using Context.Entities;
using Microsoft.EntityFrameworkCore;

namespace Context;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Admin> Admins => Set<Admin>();
    public DbSet<Annotator> Annotators => Set<Annotator>();
    public DbSet<Video> Videos => Set<Video>();
    public DbSet<Dataset> Datasets => Set<Dataset>();
    public DbSet<AnnotationSession> AnnotationSessions => Set<AnnotationSession>();
    public DbSet<SegmentResponse> SegmentResponses => Set<SegmentResponse>();
    public DbSet<QuestionAnswer> QuestionAnswers => Set<QuestionAnswer>();
    public DbSet<Question> Questions => Set<Question>();
    public DbSet<AnnotatorSurvey> AnnotatorSurveys => Set<AnnotatorSurvey>();
    public DbSet<AnnotationTaskRequest>AnnotationTaskRequests =>Set<AnnotationTaskRequest>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Admin>(entity =>
        {
            entity.Property(x => x.Name).HasColumnName("Username").HasMaxLength(200);
            entity.Property(x => x.Email).HasMaxLength(320);
            entity.Property(x => x.PasswordHash).HasMaxLength(500);
            entity.HasIndex(x => x.Email).IsUnique();
            entity.HasIndex(x => x.Name).IsUnique();
        });
        modelBuilder.Entity<Annotator>(entity =>
        {
            entity.Property(x => x.Name).HasColumnName("Username").HasMaxLength(200);
            entity.Property(x => x.Email).HasMaxLength(320);
            entity.Property(x => x.PasswordHash).HasMaxLength(500);
            entity.Property(x => x.Gender).HasMaxLength(50);
            entity.Property(x => x.Nationality).HasMaxLength(100);
            entity.HasIndex(x => x.Email).IsUnique();
            entity.HasIndex(x => x.Name).IsUnique();
        });
        modelBuilder.Entity<Dataset>(entity =>
{
    entity.Property(x => x.Name)
        .HasMaxLength(200);

    entity.Property(x => x.DatasetType)
        .HasMaxLength(100);

    entity.Property(x => x.ManifestFileName)
        .HasMaxLength(260);

    entity.Property(x => x.ManifestPath)
        .HasMaxLength(2048);

    entity.Property(x => x.IsArchived)
        .HasDefaultValue(false);

    entity.HasIndex(x => x.Name)
    .IsUnique();

    entity.HasIndex(x => x.IsArchived);
});
        modelBuilder.Entity<Video>(entity =>
{
    entity.Property(x => x.ScenarioId)
        .HasMaxLength(100);

    entity.Property(x => x.FileName)
        .HasMaxLength(260);

    entity.Property(x => x.StoragePath)
        .HasMaxLength(2048);

    entity.Property(x => x.MimeType)
        .HasMaxLength(100);

    entity.Property(x => x.ThumbnailPath)
        .HasMaxLength(2048);

    entity.Property(x => x.ProcessingStatus)
        .HasMaxLength(50);

    entity.Property(x => x.ProcessingError)
        .HasColumnType("nvarchar(max)");

    entity.Property(x => x.ScenarioType)
        .HasMaxLength(200);

    entity.Property(x => x.DrivingInstruction)
        .HasColumnType("nvarchar(max)");

    entity.Property(x => x.TrajectoryJson)
        .HasColumnType("nvarchar(max)");

    entity.Property(x => x.ActionsJson)
        .HasColumnType("nvarchar(max)");

    entity.Property(x => x.OriginalReasoningJson)
        .HasColumnType("nvarchar(max)");

    entity.HasIndex(x => new
    {
        x.DatasetId,
        x.FileName
    })
    .IsUnique();

    entity.HasIndex(x => x.ScenarioId);

    entity.Property(x => x.RequiredAnnotationCount)
    .HasDefaultValue(1);

    entity.Property(x => x.IsArchived)
    .HasDefaultValue(false);

    entity.ToTable(table => table.HasCheckConstraint(
        "CK_Videos_RequiredAnnotationCount_Positive",
        "[RequiredAnnotationCount] >= 1"));

    entity.HasIndex(x => x.IsArchived);

    entity.HasIndex(x => new
    {
    x.IsArchived,
    x.ProcessingStatus
});

    entity.HasOne(x => x.Dataset)
    .WithMany(x => x.Videos)
    .HasForeignKey(x => x.DatasetId)
    .OnDelete(DeleteBehavior.Restrict);
    
    entity.HasOne(x => x.UploadedByAdmin)
        .WithMany(x => x.UploadedVideos)
        .HasForeignKey(x => x.UploadedByAdminId)
        .OnDelete(DeleteBehavior.Restrict);
});
        modelBuilder.Entity<AnnotationSession>(entity =>
{
    entity.Property(x => x.Status)
        .HasMaxLength(50)
        .HasDefaultValue(AnnotationSessionStatus.Assigned);

    entity.ToTable(table =>
    {
        table.HasCheckConstraint(
            "CK_AnnotationSessions_Status",
            "[Status] IN ('Assigned', 'InProgress', 'Completed', 'Expired', 'Cancelled')");
        table.HasCheckConstraint(
            "CK_AnnotationSessions_ExpiryAfterAssignment",
            "[ExpiresAt] > [AssignedAt]");
    });

    entity.HasIndex(x => x.Status);

    entity.HasIndex(x => new
    {
        x.VideoId,
        x.Status
    });

    entity.HasIndex(x => new
    {
        x.AnnotatorId,
        x.Status
    });

    entity.HasOne(x => x.Annotator)
        .WithMany(x => x.AnnotationSessions)
        .HasForeignKey(x => x.AnnotatorId);

    entity.HasOne(x => x.Video)
        .WithMany(x => x.AnnotationSessions)
        .HasForeignKey(x => x.VideoId);
});
        modelBuilder.Entity<SegmentResponse>(entity =>
        {
            entity.Property(x => x.Transcript).HasColumnType("nvarchar(max)");
            entity.HasIndex(x => new { x.AnnotationSessionId, x.SegmentNumber }).IsUnique();
            entity.HasOne(x => x.AnnotationSession).WithMany(x => x.SegmentResponses).HasForeignKey(x => x.AnnotationSessionId);
        });
        modelBuilder.Entity<QuestionAnswer>(entity =>
        {
            entity.HasKey(x => new { x.SegmentResponseId, x.QuestionId });
            entity.Property(x => x.Answer).HasColumnType("nvarchar(max)");
            entity.HasOne(x => x.SegmentResponse).WithMany(x => x.QuestionAnswers).HasForeignKey(x => x.SegmentResponseId);
            entity.HasOne(x => x.Question).WithMany(x => x.Answers).HasForeignKey(x => x.QuestionId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Question>(entity =>
        {
            entity.Property(x => x.QuestionText).HasMaxLength(1000);
            entity.Property(x => x.IsActive).HasDefaultValue(true);
            entity.HasIndex(x => new { x.SegmentNo, x.IsActive });
            entity.ToTable(table => table.HasCheckConstraint("CK_Questions_SegmentNo", "[SegmentNo] IN (1, 2, 3)"));
        });
        modelBuilder.Entity<AnnotatorSurvey>(entity =>
        {
            entity.HasIndex(survey => survey.AnnotatorId).IsUnique();
            entity.HasOne(survey => survey.Annotator)
                .WithOne(annotator => annotator.Survey)
                .HasForeignKey<AnnotatorSurvey>(survey => survey.AnnotatorId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    modelBuilder.Entity<AnnotationTaskRequest>(entity =>
{
    entity.Property(request => request.Status)
        .HasMaxLength(50)
        .HasDefaultValue(
            AnnotationTaskRequestStatus.Waiting);

    entity.ToTable(table =>
    {
        table.HasCheckConstraint(
            "CK_AnnotationTaskRequests_Status",
            "[Status] IN " +
            "('Waiting', 'Fulfilled', 'Cancelled')");
    });

    entity.HasIndex(request => request.Status);

    entity.HasIndex(request => new
    {
        request.DatasetId,
        request.Status,
        request.RequestedAt
    });

    entity.HasIndex(request => new
    {
        request.AnnotatorId,
        request.DatasetId,
        request.Status
    })
    .IsUnique()
    .HasFilter("[Status] = 'Waiting'");

    entity.HasIndex(request =>
        request.AnnotationSessionId)
        .IsUnique()
        .HasFilter(
            "[AnnotationSessionId] IS NOT NULL");

    entity.HasOne(request => request.Annotator)
        .WithMany(annotator =>
            annotator.AnnotationTaskRequests)
        .HasForeignKey(request =>
            request.AnnotatorId)
        .OnDelete(DeleteBehavior.Restrict);

    entity.HasOne(request => request.Dataset)
        .WithMany(dataset =>
            dataset.AnnotationTaskRequests)
        .HasForeignKey(request =>
            request.DatasetId)
        .OnDelete(DeleteBehavior.Restrict);

    entity.HasOne(request =>
            request.AnnotationSession)
        .WithOne()
        .HasForeignKey<AnnotationTaskRequest>(
            request => request.AnnotationSessionId)
        .OnDelete(DeleteBehavior.Restrict);
});    
    }
}
