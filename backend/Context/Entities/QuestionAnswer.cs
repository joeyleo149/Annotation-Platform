namespace Context.Entities;

public sealed class QuestionAnswer
{
    public int SegmentResponseId { get; set; }
    public int QuestionId { get; set; }
    public required string Answer { get; set; }
    public SegmentResponse SegmentResponse { get; set; } = null!;
    public Question Question { get; set; } = null!;
}
