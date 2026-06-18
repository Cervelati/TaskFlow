namespace TaskFlow.Api.DTOs;

public record CreateColumnRequest(
    string Name,
    string Color,
    int? WorkspaceId,
    bool IsFinished = false
);

public record UpdateColumnRequest(
    string Name,
    string Color,
    int Position,
    bool IsFinished = false
);

public record ColumnResponse(
    int Id,
    string Name,
    string Color,
    int Position,
    int? WorkspaceId,
    bool IsFinished
);
