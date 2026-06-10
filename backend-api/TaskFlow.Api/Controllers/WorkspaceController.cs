using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using TaskFlow.Api.DTOs;
using TaskFlow.Api.Services;

namespace TaskFlow.Api.Controllers;

[ApiController]
[Route("api/workspaces")]
[Authorize]
public class WorkspaceController : ControllerBase
{
    private readonly WorkspaceService _workspaceService;
    private readonly InviteService _inviteService;

    public WorkspaceController(WorkspaceService workspaceService, InviteService inviteService)
    {
        _workspaceService = workspaceService;
        _inviteService = inviteService;
    }

    private int GetUserId() =>
        int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // ── Workspaces ─────────────────────────────────────────

    /// <summary>Lista todos os workspaces do usuário autenticado</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll() =>
        Ok(await _workspaceService.GetUserWorkspacesAsync(GetUserId()));

    /// <summary>Busca um workspace por ID</summary>
    [HttpGet("{workspaceId:guid}")]
    public async Task<IActionResult> GetById(Guid workspaceId)
    {
        var result = await _workspaceService.GetByIdAsync(workspaceId, GetUserId());
        return result == null ? NotFound() : Ok(result);
    }

    /// <summary>Cria um novo workspace (máx. 3 por usuário no plano gratuito)</summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateWorkspaceDto dto)
    {
        var (workspace, error) = await _workspaceService.CreateAsync(GetUserId(), dto);
        if (error != null) return BadRequest(new { message = error });
        return CreatedAtAction(nameof(GetById), new { workspaceId = workspace!.Id }, workspace);
    }

    /// <summary>Atualiza nome/descrição do workspace</summary>
    [HttpPut("{workspaceId:guid}")]
    public async Task<IActionResult> Update(Guid workspaceId, [FromBody] UpdateWorkspaceDto dto)
    {
        var (success, error) = await _workspaceService.UpdateAsync(workspaceId, GetUserId(), dto);
        if (!success) return error == "Workspace não encontrado." ? NotFound() : Forbid();
        return NoContent();
    }

    /// <summary>Deleta um workspace (apenas Owner)</summary>
    [HttpDelete("{workspaceId:guid}")]
    public async Task<IActionResult> Delete(Guid workspaceId)
    {
        var (success, error) = await _workspaceService.DeleteAsync(workspaceId, GetUserId());
        if (!success) return NotFound(new { message = error });
        return NoContent();
    }

    // ── Membros ────────────────────────────────────────────

    /// <summary>Lista membros do workspace</summary>
    [HttpGet("{workspaceId:guid}/members")]
    public async Task<IActionResult> GetMembers(Guid workspaceId)
    {
        var members = await _workspaceService.GetMembersAsync(workspaceId, GetUserId());
        return members == null ? NotFound() : Ok(members);
    }

    /// <summary>Altera role de um membro (apenas Owner)</summary>
    [HttpPatch("{workspaceId:guid}/members/{targetUserId:int}/role")]
    public async Task<IActionResult> UpdateMemberRole(
        Guid workspaceId, int targetUserId, [FromBody] UpdateMemberRoleDto dto)
    {
        var (success, error) = await _workspaceService.UpdateMemberRoleAsync(
            workspaceId, GetUserId(), targetUserId, dto.Role);
        if (!success) return BadRequest(new { message = error });
        return NoContent();
    }

    /// <summary>Remove um membro do workspace</summary>
    [HttpDelete("{workspaceId:guid}/members/{targetUserId:int}")]
    public async Task<IActionResult> RemoveMember(Guid workspaceId, int targetUserId)
    {
        var (success, error) = await _workspaceService.RemoveMemberAsync(
            workspaceId, GetUserId(), targetUserId);
        if (!success) return BadRequest(new { message = error });
        return NoContent();
    }

    /// <summary>Sair de um workspace</summary>
    [HttpPost("{workspaceId:guid}/leave")]
    public async Task<IActionResult> Leave(Guid workspaceId)
    {
        var (success, error) = await _workspaceService.LeaveWorkspaceAsync(workspaceId, GetUserId());
        if (!success) return BadRequest(new { message = error });
        return NoContent();
    }

    // ── Convites ───────────────────────────────────────────

    /// <summary>Lista convites do workspace</summary>
    [HttpGet("{workspaceId:guid}/invites")]
    public async Task<IActionResult> GetInvites(Guid workspaceId)
    {
        var invites = await _inviteService.GetWorkspaceInvitesAsync(workspaceId, GetUserId());
        return invites == null ? NotFound() : Ok(invites);
    }

    /// <summary>Envia um convite por e-mail</summary>
    [HttpPost("{workspaceId:guid}/invites")]
    public async Task<IActionResult> CreateInvite(Guid workspaceId, [FromBody] CreateInviteDto dto)
    {
        var (invite, error) = await _inviteService.CreateInviteAsync(workspaceId, GetUserId(), dto);
        if (error != null) return BadRequest(new { message = error });
        return Ok(invite);
    }

    /// <summary>Aceita um convite via token</summary>
    [HttpPost("invites/accept")]
    public async Task<IActionResult> AcceptInvite([FromBody] AcceptInviteDto dto)
    {
        var (success, error) = await _inviteService.AcceptInviteAsync(dto.Token, GetUserId());
        if (!success) return BadRequest(new { message = error });
        return Ok(new { message = "Convite aceito com sucesso!" });
    }

    /// <summary>Preview do convite (sem autenticação — para a página invite.html)</summary>
    [HttpGet("invites/preview/{token}")]
    [AllowAnonymous]
    public async Task<IActionResult> PreviewInvite(string token)
    {
        var invite = await _inviteService.GetInvitePreviewAsync(token);
        return invite == null ? NotFound() : Ok(invite);
    }

    /// <summary>Revoga um convite pendente</summary>
    [HttpDelete("{workspaceId:guid}/invites/{inviteId:int}")]
    public async Task<IActionResult> RevokeInvite(Guid workspaceId, int inviteId)
    {
        var (success, error) = await _inviteService.RevokeInviteAsync(inviteId, workspaceId, GetUserId());
        if (!success) return BadRequest(new { message = error });
        return NoContent();
    }
}