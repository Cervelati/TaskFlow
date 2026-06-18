using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TaskFlow.Api.DTOs;
using TaskFlow.Api.Services;
using TaskFlow.Api.Models;

[ApiController]
[Route("api/columns")]
[Authorize]
public class ColumnController : ControllerBase
{
    private readonly ColumnService _svc;
    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    public ColumnController(ColumnService svc) { _svc = svc; }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int? workspaceId)
    {
        await _svc.SeedDefaultColumnsAsync(UserId, workspaceId);
        var cols = await _svc.GetColumnsAsync(UserId, workspaceId);
        return Ok(cols);
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateColumnRequest req)
    {
        var col = await _svc.CreateColumnAsync(UserId, req);
        return CreatedAtAction(nameof(GetAll), col);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, UpdateColumnRequest req)
    {
        var col = await _svc.UpdateColumnAsync(UserId, id, req);
        if (col is null) return NotFound();
        return Ok(col);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var result = await _svc.DeleteColumnAsync(UserId, id);

        return result switch
        {
            DeleteColumnResult.NotFound  => NotFound(),
            DeleteColumnResult.HasTasks  => Conflict(new { message = "Mova ou remova as tarefas antes de deletar esta coluna." }),
            DeleteColumnResult.Success   => NoContent(),
            _                            => StatusCode(500)
        };
    }
}