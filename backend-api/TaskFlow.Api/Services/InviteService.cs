using Microsoft.EntityFrameworkCore;
using TaskFlow.Api.Data;
using TaskFlow.Api.DTOs;
using TaskFlow.Api.Models;

namespace TaskFlow.Api.Services;

public class InviteService
{
    private readonly AppDbContext _db;
    private readonly NotificationClient _notificationClient;
    private readonly IConfiguration _config;

    public InviteService(AppDbContext db, NotificationClient notificationClient, IConfiguration config)
    {
        _db = db;
        _notificationClient = notificationClient;
        _config = config;
    }

    // ── Criar e enviar convite ─────────────────────────────
    public async Task<(InviteResponseDto? invite, string? error)> CreateInviteAsync(
        Guid workspaceId, int invitedByUserId, CreateInviteDto dto)
    {
        // Verificar permissão
        var requester = await _db.WorkspaceMembers
            .Include(m => m.Workspace)
            .FirstOrDefaultAsync(m => m.WorkspaceId == workspaceId && m.UserId == invitedByUserId);

        if (requester == null || (requester.Role != "Owner" && requester.Role != "Admin"))
            return (null, "Sem permissão para convidar membros.");

        // Verificar se o e-mail já é membro
        var alreadyMember = await _db.WorkspaceMembers
            .Include(m => m.User)
            .AnyAsync(m => m.WorkspaceId == workspaceId && m.User.Email == dto.Email);

        if (alreadyMember)
            return (null, "Este usuário já é membro do workspace.");

        // Verificar convite pendente
        var existingInvite = await _db.Invites
            .FirstOrDefaultAsync(i =>
                i.WorkspaceId == workspaceId &&
                i.Email == dto.Email &&
                i.AcceptedAt == null &&
                i.ExpiresAt > DateTime.UtcNow);

        if (existingInvite != null)
            return (null, "Já existe um convite pendente para este e-mail.");

        var invite = new Invite
        {
            WorkspaceId = workspaceId,
            InvitedByUserId = invitedByUserId,
            Email = dto.Email.ToLower().Trim(),
            Token = Guid.NewGuid(),
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            CreatedAt = DateTime.UtcNow
        };

        _db.Invites.Add(invite);
        await _db.SaveChangesAsync();

        // Enviar e-mail via notification-service
        var frontendUrl = _config["FrontendUrl"] ?? "http://localhost:3000";
        var inviteLink = $"{frontendUrl}/invite.html?token={invite.Token}";

        await _notificationClient.SendInviteEmailAsync(
            dto.Email,
            requester.Workspace.Name,
            inviteLink,
            invite.ExpiresAt
        );

        return (MapToDto(invite, requester.Workspace.Name), null);
    }

    // ── Aceitar convite ────────────────────────────────────
    public async Task<(bool success, string? error)> AcceptInviteAsync(string token, int userId)
    {
        if (!Guid.TryParse(token, out var tokenGuid))
            return (false, "Token inválido.");

        var invite = await _db.Invites
            .Include(i => i.Workspace)
            .FirstOrDefaultAsync(i => i.Token == tokenGuid);

        if (invite == null) return (false, "Convite não encontrado.");
        if (invite.AcceptedAt != null) return (false, "Convite já foi utilizado.");
        if (invite.ExpiresAt < DateTime.UtcNow) return (false, "Convite expirado.");

        // Verificar se já é membro
        var alreadyMember = await _db.WorkspaceMembers
            .AnyAsync(m => m.WorkspaceId == invite.WorkspaceId && m.UserId == userId);

        if (alreadyMember) return (false, "Você já é membro deste workspace.");

        var member = new WorkspaceMember
        {
            WorkspaceId = invite.WorkspaceId,
            UserId = userId,
            Role = "Member",
            JoinedAt = DateTime.UtcNow
        };

        _db.WorkspaceMembers.Add(member);

        invite.AcceptedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return (true, null);
    }

    // ── Listar convites de um workspace ───────────────────
    public async Task<List<InviteResponseDto>?> GetWorkspaceInvitesAsync(Guid workspaceId, int userId)
    {
        var isMember = await _db.WorkspaceMembers
            .AnyAsync(m => m.WorkspaceId == workspaceId &&
                           m.UserId == userId &&
                           (m.Role == "Owner" || m.Role == "Admin"));

        if (!isMember) return null;

        var workspace = await _db.Workspaces.FindAsync(workspaceId);

        return await _db.Invites
            .Where(i => i.WorkspaceId == workspaceId)
            .OrderByDescending(i => i.CreatedAt)
            .Select(i => MapToDto(i, workspace!.Name))
            .ToListAsync();
    }

    // ── Revogar convite ────────────────────────────────────
    public async Task<(bool success, string? error)> RevokeInviteAsync(
        int inviteId, Guid workspaceId, int userId)
    {
        var requester = await _db.WorkspaceMembers
            .FirstOrDefaultAsync(m => m.WorkspaceId == workspaceId && m.UserId == userId);

        if (requester == null || (requester.Role != "Owner" && requester.Role != "Admin"))
            return (false, "Sem permissão para revogar convites.");

        var invite = await _db.Invites
            .FirstOrDefaultAsync(i => i.Id == inviteId && i.WorkspaceId == workspaceId);

        if (invite == null) return (false, "Convite não encontrado.");
        if (invite.AcceptedAt != null) return (false, "Convite já foi aceito.");

        _db.Invites.Remove(invite);
        await _db.SaveChangesAsync();

        return (true, null);
    }

    // ── Preview do convite (sem autenticação) ──────────────
    public async Task<InviteResponseDto?> GetInvitePreviewAsync(string token)
    {
        if (!Guid.TryParse(token, out var tokenGuid)) return null;

        var invite = await _db.Invites
            .Include(i => i.Workspace)
            .FirstOrDefaultAsync(i => i.Token == tokenGuid);

        return invite == null ? null : MapToDto(invite, invite.Workspace.Name);
    }

    private static InviteResponseDto MapToDto(Invite invite, string workspaceName) => new()
    {
        Id = invite.Id,
        WorkspaceId = invite.WorkspaceId,
        WorkspaceName = workspaceName,
        Email = invite.Email,
        Token = invite.Token.ToString(),
        ExpiresAt = invite.ExpiresAt,
        IsAccepted = invite.AcceptedAt != null,
        CreatedAt = invite.CreatedAt
    };
}