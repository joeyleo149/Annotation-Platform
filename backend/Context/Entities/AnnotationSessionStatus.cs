namespace Context.Entities;

public static class AnnotationSessionStatus
{
    public const string Assigned = "Assigned";
    public const string InProgress = "InProgress";
    public const string Completed = "Completed";
    public const string Expired = "Expired";
    public const string Cancelled = "Cancelled";

    public static readonly IReadOnlySet<string> All =
        new HashSet<string>(StringComparer.Ordinal)
        {
            Assigned,
            InProgress,
            Completed,
            Expired,
            Cancelled
        };
}