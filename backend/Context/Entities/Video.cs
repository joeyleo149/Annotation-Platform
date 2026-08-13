namespace Context.Entities;

public sealed class Video
{
    public int Id { get; set; }

    // KITScenes identification
    public string? ScenarioId { get; set; }
    public int? DatasetRowIndex { get; set; }

    // Uploaded file information
    public required string FileName { get; set; }
    public required string StoragePath { get; set; }
    public string MimeType { get; set; } = "video/mp4";
    public long FileSizeBytes { get; set; }

    // Metadata extracted from the video
    public double? DurationSeconds { get; set; }
    public double? FrameRate { get; set; }
    public int? Width { get; set; }
    public int? Height { get; set; }
    public string? ThumbnailPath { get; set; }

    // Processing state
    public string ProcessingStatus { get; set; } = "Pending";
    public string? ProcessingError { get; set; }

    // Information mapped from the uploaded manifest
    public bool ManifestMatched { get; set; }
    public string? ScenarioType { get; set; }
    public string? DrivingInstruction { get; set; }
    public string? TrajectoryJson { get; set; }
    public string? ActionsJson { get; set; }
    public string? OriginalReasoningJson { get; set; }

    // Upload ownership
    public int UploadedByAdminId { get; set; }
    public DateTimeOffset UploadedAt { get; set; }

    // Database relationships
    public Admin UploadedByAdmin { get; set; } = null!;
    public ICollection<AnnotationSession> AnnotationSessions { get; set; } = [];
}