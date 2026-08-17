namespace Context.Entities;

public sealed class Question
{
    public int Id { get; set; }
    public required string QuestionText { get; set; }
    public int SegmentNo { get; set; }
    public bool IsActive { get; set; } = true;
    public ICollection<QuestionAnswer> Answers { get; set; } = [];
}
