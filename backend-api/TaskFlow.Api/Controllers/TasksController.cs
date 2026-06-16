using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TaskFlow.Api.DTOs;
using TaskFlow.Api.Services;

namespace TaskFlow.Api.Controllers;

[ApiController]
[Route("api/tasks")]
[Authorize]
public class TasksController : ControllerBase
{
    private readonly TaskService _taskService;

    public TasksController(TaskService taskService)
    {
        _taskService = taskService;
    }

    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    /// <summary>Lista todas as tarefas do usuário autenticado</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int? workspaceId = null)
    {
        var tasks = await _taskService.GetAllAsync(UserId, workspaceId);
        return Ok(tasks);
    }

    /// <summary>Busca uma tarefa por ID</summary>
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var task = await _taskService.GetByIdAsync(id, UserId);
        if (task is null)
            return NotFound(new { message = "Tarefa não encontrada." });
        return Ok(task);
    }

    /// <summary>Cria uma nova tarefa</summary>
    [HttpPost]
    public async Task<IActionResult> Create(CreateTaskRequest request)
    {
        var task = await _taskService.CreateAsync(request, UserId);
        return CreatedAtAction(nameof(GetById), new { id = task.Id }, task);
    }

    /// <summary>Atualiza uma tarefa existente</summary>
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, UpdateTaskRequest request)
    {
        var task = await _taskService.UpdateAsync(id, request, UserId);
        if (task is null)
            return NotFound(new { message = "Tarefa não encontrada." });
        return Ok(task);
    }

    /// <summary>Remove uma tarefa</summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var deleted = await _taskService.DeleteAsync(id, UserId);
        if (!deleted)
            return NotFound(new { message = "Tarefa não encontrada." });
        return NoContent();
    }
}