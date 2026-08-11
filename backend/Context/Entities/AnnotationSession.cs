namespace Context.Entities;

public sealed class AnnotationSession
{
    public int Id { get; set; }
    public int AnnotatorId { get; set; }
    public int VideoId { get; set; }
    public DateTimeOffset AssignedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }

    public Annotator Annotator { get; set; } = null!;
    public Video Video { get; set; } = null!;
    public ICollection<SegmentResponse> SegmentResponses { get; set; } = [];
}
