using Microsoft.EntityFrameworkCore;
using TaskFlow.Api.Data;
using TaskFlow.Api.DTOs;
using TaskFlow.Api.Models;

namespace TaskFlow.Api.Services;

public class WorkspaceService
{
    private readonly AppDbContext _db;
    private const int MaxWorkspacesPerUser = 3;

    public WorkspaceService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<List<WorkspaceResponseDto>> GetUserWorkspacesAsync(int userId)
    {
        var memberships = await _db.WorkspaceMembers
            .Include(m => m.Workspace)
            .Where(m => m.UserId == userId)
            .ToListAsync();

        return memberships.Select(m => new WorkspaceResponseDto
        {
            Id = m.Workspace.Id,
            Name = m.Workspace.Name,
            Description = m.Workspace.Description,
            OwnerId = m.Workspace.OwnerId,
            CreatedAt = m.Workspace.CreatedAt,
            UserRole = m.Role,
            CompletionMode = m.Workspace.CompletionMode,
            MemberCount = _db.WorkspaceMembers.Count(wm => wm.WorkspaceId == m.WorkspaceId)
        }).ToList();
    }

    public async Task<WorkspaceResponseDto?> GetByIdAsync(int workspaceId, int userId)
    {
        var membership = await _db.WorkspaceMembers
            .Include(m => m.Workspace)
            .FirstOrDefaultAsync(m => m.WorkspaceId == workspaceId && m.UserId == userId);

        if (membership == null) return null;

        return new WorkspaceResponseDto
        {
            Id = membership.Workspace.Id,
            Name = membership.Workspace.Name,
            Description = membership.Workspace.Description,
            OwnerId = membership.Workspace.OwnerId,
            CreatedAt = membership.Workspace.CreatedAt,
            UserRole = membership.Role,
            CompletionMode = membership.Workspace.CompletionMode,
            MemberCount = await _db.WorkspaceMembers.CountAsync(m => m.WorkspaceId == workspaceId)
        };
    }

    public async Task<(WorkspaceResponseDto? workspace, string? error)> CreateAsync(
        int userId, CreateWorkspaceDto dto)
    {
        var ownedCount = await _db.WorkspaceMembers
            .CountAsync(m => m.UserId == userId && m.Role == "Owner");

        if (ownedCount >= MaxWorkspacesPerUser)
            return (null, $"Limite de {MaxWorkspacesPerUser} workspaces atingido no plano gratuito.");

        var workspace = new Workspace
        {
            Name = dto.Name.Trim(),
            Description = dto.Description?.Trim() ?? string.Empty,
            CompletionMode = dto.CompletionMode ?? "column",
            OwnerId = userId,
            CreatedAt = DateTime.UtcNow
        };

        _db.Workspaces.Add(workspace);
        await _db.SaveChangesAsync();

        var member = new WorkspaceMember
        {
            WorkspaceId = workspace.Id,
            UserId = userId,
            Role = "Owner",
            JoinedAt = DateTime.UtcNow
        };

        _db.WorkspaceMembers.Add(member);
        await _db.SaveChangesAsync();

        return (new WorkspaceResponseDto
        {
            Id = workspace.Id,
            Name = workspace.Name,
            Description = workspace.Description,
            OwnerId = workspace.OwnerId,
            CreatedAt = workspace.CreatedAt,
            CompletionMode = workspace.CompletionMode,
            UserRole = "Owner",
            MemberCount = 1
        }, null);
    }

    public async Task<(bool success, string? error)> UpdateAsync(
        int workspaceId, int userId, UpdateWorkspaceDto dto)
    {
        var membership = await _db.WorkspaceMembers
            .Include(m => m.Workspace)
            .FirstOrDefaultAsync(m => m.WorkspaceId == workspaceId && m.UserId == userId);

        if (membership == null) return (false, "Workspace não encontrado.");
        if (membership.Role != "Owner" && membership.Role != "Admin")
            return (false, "Sem permissão para editar este workspace.");

        membership.Workspace.Name = dto.Name.Trim();
        membership.Workspace.Description = dto.Description?.Trim() ?? string.Empty;
        membership.Workspace.CompletionMode = dto.CompletionMode ?? "column";
        await _db.SaveChangesAsync();

        return (true, null);
    }

    public async Task<(bool success, string? error)> DeleteAsync(int workspaceId, int userId)
    {
        var workspace = await _db.Workspaces
            .FirstOrDefaultAsync(w => w.Id == workspaceId && w.OwnerId == userId);

        if (workspace == null) return (false, "Workspace não encontrado ou sem permissão.");

        _db.Workspaces.Remove(workspace);
        await _db.SaveChangesAsync();

        return (true, null);
    }

    public async Task<List<WorkspaceMemberResponseDto>?> GetMembersAsync(int workspaceId, int userId)
    {
        var isMember = await _db.WorkspaceMembers
            .AnyAsync(m => m.WorkspaceId == workspaceId && m.UserId == userId);

        if (!isMember) return null;

        return await _db.WorkspaceMembers
            .Include(m => m.User)
            .Where(m => m.WorkspaceId == workspaceId)
            .Select(m => new WorkspaceMemberResponseDto
            {
                UserId = m.UserId,
                UserName = m.User.Name,
                Email = m.User.Email,
                Role = m.Role,
                JoinedAt = m.JoinedAt
            })
            .ToListAsync();
    }

    public async Task<(bool success, string? error)> UpdateMemberRoleAsync(
        int workspaceId, int requestingUserId, int targetUserId, string newRole)
    {
        var validRoles = new[] { "Admin", "Member" };
        if (!validRoles.Contains(newRole))
            return (false, "Role inválida. Use 'Admin' ou 'Member'.");

        var requester = await _db.WorkspaceMembers
            .FirstOrDefaultAsync(m => m.WorkspaceId == workspaceId && m.UserId == requestingUserId);

        if (requester == null || requester.Role != "Owner")
            return (false, "Apenas o Owner pode alterar roles.");

        var target = await _db.WorkspaceMembers
            .FirstOrDefaultAsync(m => m.WorkspaceId == workspaceId && m.UserId == targetUserId);

        if (target == null) return (false, "Membro não encontrado.");
        if (target.Role == "Owner") return (false, "Não é possível alterar o role do Owner.");

        target.Role = newRole;
        await _db.SaveChangesAsync();

        return (true, null);
    }

    public async Task<(bool success, string? error)> RemoveMemberAsync(
        int workspaceId, int requestingUserId, int targetUserId)
    {
        var requester = await _db.WorkspaceMembers
            .FirstOrDefaultAsync(m => m.WorkspaceId == workspaceId && m.UserId == requestingUserId);

        if (requester == null || (requester.Role != "Owner" && requester.Role != "Admin"))
            return (false, "Sem permissão para remover membros.");

        var target = await _db.WorkspaceMembers
            .FirstOrDefaultAsync(m => m.WorkspaceId == workspaceId && m.UserId == targetUserId);

        if (target == null) return (false, "Membro não encontrado.");
        if (target.Role == "Owner") return (false, "Não é possível remover o Owner.");

        _db.WorkspaceMembers.Remove(target);
        await _db.SaveChangesAsync();

        return (true, null);
    }

    public async Task<(bool success, string? error)> LeaveWorkspaceAsync(int workspaceId, int userId)
    {
        var membership = await _db.WorkspaceMembers
            .FirstOrDefaultAsync(m => m.WorkspaceId == workspaceId && m.UserId == userId);

        if (membership == null) return (false, "Você não é membro deste workspace.");
        if (membership.Role == "Owner") return (false, "Owner não pode sair. Delete o workspace ou transfira ownership.");

        _db.WorkspaceMembers.Remove(membership);
        await _db.SaveChangesAsync();

        return (true, null);
    }
}