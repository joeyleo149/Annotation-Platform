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

    // Soft-delete: when an annotator deletes their account we keep the row (and
    // therefore all their annotations, sessions, answers and their appearance in
    // exports) intact, but revoke access and anonymize the identifying fields so
    // the original username/email become reusable.
    public bool IsDeleted { get; set; } = false;
    public DateTimeOffset? DeletedAt { get; set; }

    public AnnotatorSurvey? Survey { get; set; }
    public ICollection<AnnotationSession> AnnotationSessions { get; set; } = [];
    public ICollection<AnnotationTaskRequest>
    AnnotationTaskRequests { get; set; } = [];
}
