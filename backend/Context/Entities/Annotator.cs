namespace Context.Entities;

public sealed class Annotator
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public required string Email { get; set; }
    public required string PasswordHash { get; set; }
    public DateOnly DateOfBirth { get; set; }
    public required string Gender { get; set; }
    public required string Nationality { get; set; }


    public bool HasCompletedSurvey { get; set; } = false;
    public ICollection<AnnotationSession> AnnotationSessions { get; set; } = [];
    public ICollection<AnnotationTaskRequest>
    AnnotationTaskRequests { get; set; } = [];
}
