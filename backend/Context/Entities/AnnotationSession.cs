namespace Context.Entities;

public sealed class AnnotationSession
{
    public int Id { get; set; }

    // Assignment ownership
    public int AnnotatorId { get; set; }
    public int VideoId { get; set; }

    // Assignment lifecycle
    public string Status { get; set; } =
        AnnotationSessionStatus.Assigned;

    public DateTimeOffset AssignedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public DateTimeOffset? CancelledAt { get; set; }

    // Database relationships
    public Annotator Annotator { get; set; } = null!;
    public Video Video { get; set; } = null!;

    public ICollection<SegmentResponse> SegmentResponses
        { get; set; } = [];
}