namespace Context.Entities;

public sealed class QuestionAnswer
{
    public int SegmentResponseId { get; set; }
    public int QuestionNumber { get; set; }
    public required string Answer { get; set; }
    public SegmentResponse SegmentResponse { get; set; } = null!;
}
