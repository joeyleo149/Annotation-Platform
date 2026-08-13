namespace Context.Entities;

public sealed class SegmentResponse
{
    public int Id { get; set; }
    public int AnnotationSessionId { get; set; }
    public int SegmentNumber { get; set; }

    public TimeSpan StartTime { get; set; }
    public TimeSpan EndTime { get; set; }

    public required string Transcript { get; set; }
    public DateTimeOffset SubmittedAt { get; set; }
    public AnnotationSession AnnotationSession { get; set; } = null!;
    public ICollection<QuestionAnswer> QuestionAnswers { get; set; } = [];
}
