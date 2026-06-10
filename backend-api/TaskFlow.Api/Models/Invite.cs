namespace TaskFlow.Api.Models;

public class Invite
{
    public int Id { get; set; }
    public int WorkspaceId { get; set; }
    public Workspace Workspace { get; set; } = null!;
    public string Email { get; set; } = string.Empty;
    public string Token { get; set; } = Guid.NewGuid().ToString();
    public string Status { get; set; } = "Pending";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; } = DateTime.UtcNow.AddDays(7);
}