namespace Context.Entities;

public sealed class Admin
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public required string Email { get; set; }
    public required string PasswordHash { get; set; }

    public ICollection<Video> UploadedVideos { get; set; } = [];
}
