namespace Context.Entities;

public sealed class Dataset
{
    public int Id { get; set; }

    // Dataset identification
    public required string Name { get; set; }
    public required string DatasetType { get; set; }

    // Stored manifest information
    public required string ManifestFileName { get; set; }
    public required string ManifestPath { get; set; }

    // Dataset lifecycle
    public bool IsArchived { get; set; }
    public DateTimeOffset? ArchivedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    // Database relationships
    public ICollection<Video> Videos { get; set; } = [];
}