namespace TaskFlow.Api.Models;

    public enum DeleteColumnResult
    {
        Success,
        NotFound,
        HasTasks
    }

public class BoardColumn
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Color { get; set; } = "#DFE1E6";
    public int Position { get; set; }
    public bool IsFinished { get; set; } = false;

    public int UserId { get; set; }
    public User User { get; set; } = null!;

    public int? WorkspaceId { get; set; }
    public Workspace? Workspace { get; set; }

    public ICollection<TaskItem> Tasks { get; set; } = new List<TaskItem>();

}