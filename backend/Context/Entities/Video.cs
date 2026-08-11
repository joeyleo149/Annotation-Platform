namespace Context.Entities;

public sealed class Video
{
    public int Id { get; set; }
    public required string FileName { get; set; }
    public required string StoragePath { get; set; }
    public int UploadedByAdminId { get; set; }
    public DateTimeOffset UploadedAt { get; set; }

    public Admin UploadedByAdmin { get; set; } = null!;
    public ICollection<AnnotationSession> AnnotationSessions { get; set; } = [];
}
