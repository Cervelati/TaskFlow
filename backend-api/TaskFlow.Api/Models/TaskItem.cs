namespace TaskFlow.Api.Models;

public class TaskItem
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public bool IsCompleted { get; set; } = false;
    public string Status { get; set; } = "Todo";     // mantido por compatibilidade
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public DateTime? DueDate { get; set; }

    public int UserId { get; set; }
    public User User { get; set; } = null!;

    // null = tarefa pessoal, preenchido = tarefa do workspace
    public int? WorkspaceId { get; set; }
    public Workspace? Workspace { get; set; }

    // Referência direta à coluna (resolve duplicação por nome igual)
    public int? ColumnId { get; set; }
    public BoardColumn? Column { get; set; }
}