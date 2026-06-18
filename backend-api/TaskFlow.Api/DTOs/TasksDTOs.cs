namespace TaskFlow.Api.DTOs;

public record CreateTaskRequest(
    string Title,
    string Description,
    DateTime? DueDate,
    string? Status,
    int? WorkspaceId,
    int? ColumnId
);

public record UpdateTaskRequest(
    string Title,
    string Description,
    bool IsCompleted,
    DateTime? DueDate,
    string? Status,
    int? ColumnId
);

public record TaskResponse(
    int Id,
    string Title,
    string Description,
    bool IsCompleted,
    DateTime CreatedAt,
    DateTime? DueDate,
    int UserId,
    string Status,
    int? WorkspaceId,
    int? ColumnId
);
