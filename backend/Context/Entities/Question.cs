namespace Context.Entities;

public sealed class Question
{
    public int Id { get; set; }
    public int QuestionNumber { get; set; } // matches QuestionAnswer.QuestionNumber
    public required string Text { get; set; }
}