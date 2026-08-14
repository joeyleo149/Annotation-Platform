namespace Context.Entities;

public static class AnnotationTaskRequestStatus
{
    public const string Waiting = "Waiting";
    public const string Fulfilled = "Fulfilled";
    public const string Cancelled = "Cancelled";

    public static readonly string[] All =
    [
        Waiting,
        Fulfilled,
        Cancelled
    ];
}