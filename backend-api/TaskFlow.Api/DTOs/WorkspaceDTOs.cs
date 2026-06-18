namespace TaskFlow.Api.DTOs;

public class CreateWorkspaceDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string CompletionMode { get; set; } = "column"; // "column" ou "checkbox"
}

public class UpdateWorkspaceDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string CompletionMode { get; set; } = "column";
}

public class WorkspaceResponseDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int OwnerId { get; set; }
    public DateTime CreatedAt { get; set; }
    public string UserRole { get; set; } = string.Empty;
    public int MemberCount { get; set; }
    public string CompletionMode { get; set; } = "column"; // ← novo
}

public class WorkspaceMemberResponseDto
{
    public int UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public DateTime JoinedAt { get; set; }
}

public class UpdateMemberRoleDto
{
    public string Role { get; set; } = string.Empty;
}

public class CreateInviteDto
{
    public string Email { get; set; } = string.Empty;
}

public class InviteResponseDto
{
    public int Id { get; set; }
    public int WorkspaceId { get; set; }
    public string WorkspaceName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Token { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public bool IsAccepted { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class AcceptInviteDto
{
    public string Token { get; set; } = string.Empty;
}