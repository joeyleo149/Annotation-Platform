namespace Context.Entities;

public sealed class AnnotationTaskRequest
{
    public int Id { get; set; }

    public int AnnotatorId { get; set; }
    public int DatasetId { get; set; }

    public string Status { get; set; } =
        AnnotationTaskRequestStatus.Waiting;

    public DateTimeOffset RequestedAt { get; set; }
    public DateTimeOffset? FulfilledAt { get; set; }
    public DateTimeOffset? CancelledAt { get; set; }

    public int? AnnotationSessionId { get; set; }

    public Annotator Annotator { get; set; } = null!;
    public Dataset Dataset { get; set; } = null!;

    public AnnotationSession? AnnotationSession
        { get; set; }
}