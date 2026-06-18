using Microsoft.EntityFrameworkCore;
using TaskFlow.Api.Data;
using TaskFlow.Api.DTOs;
using TaskFlow.Api.Models;

namespace TaskFlow.Api.Services;

public class TaskService
{
    private readonly AppDbContext _db;
    private readonly NotificationClient _notificationClient;

    public TaskService(AppDbContext db, NotificationClient notificationClient)
    {
        _db = db;
        _notificationClient = notificationClient;
    }

    public async Task<List<TaskResponse>> GetAllAsync(int userId, int? workspaceId = null)
    {
        if (workspaceId.HasValue)
        {
            var isMember = await _db.WorkspaceMembers
                .AnyAsync(m => m.WorkspaceId == workspaceId && m.UserId == userId);
            if (!isMember) return new List<TaskResponse>();
        }

        return await _db.TaskItems
            .Where(t => t.UserId == userId && t.WorkspaceId == workspaceId)
            .OrderByDescending(t => t.CreatedAt)
            .Select(t => new TaskResponse(
                t.Id, t.Title, t.Description,
                t.IsCompleted, t.CreatedAt, t.DueDate, t.UserId,
                t.Status, t.WorkspaceId, t.ColumnId))
            .ToListAsync();
    }

    public async Task<TaskResponse?> GetByIdAsync(int id, int userId)
    {
        var task = await _db.TaskItems
            .FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId);
        return task is null ? null : ToResponse(task);
    }

    public async Task<TaskResponse> CreateAsync(CreateTaskRequest request, int userId)
    {
        if (request.WorkspaceId.HasValue)
        {
            var isMember = await _db.WorkspaceMembers
                .AnyAsync(m => m.WorkspaceId == request.WorkspaceId && m.UserId == userId);
            if (!isMember)
                throw new UnauthorizedAccessException("Sem acesso ao workspace.");
        }

        // Resolve o nome da coluna a partir do ColumnId, se fornecido
        string status = request.Status ?? "Todo";
        if (request.ColumnId.HasValue)
        {
            var col = await _db.Columns
                .FirstOrDefaultAsync(c => c.Id == request.ColumnId && c.UserId == userId);
            if (col is not null) status = col.Name;
        }

        var task = new TaskItem
        {
            Title       = request.Title,
            Description = request.Description,
            DueDate     = request.DueDate,
            Status      = status,
            ColumnId    = request.ColumnId,
            UserId      = userId,
            WorkspaceId = request.WorkspaceId
        };

        _db.TaskItems.Add(task);
        await _db.SaveChangesAsync();

        await _notificationClient.SendTaskCreatedAsync(userId, task.Id, task.Title);

        return ToResponse(task);
    }

    public async Task<TaskResponse?> UpdateAsync(int id, UpdateTaskRequest request, int userId)
    {
        var task = await _db.TaskItems
            .FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId);
        if (task is null) return null;

        // Resolve coluna pelo ColumnId (prioritário) ou pelo Status
        if (request.ColumnId.HasValue)
        {
            var col = await _db.Columns
                .FirstOrDefaultAsync(c => c.Id == request.ColumnId && c.UserId == userId);
            if (col is not null)
            {
                task.ColumnId = col.Id;
                task.Status   = col.Name;
            }
        }
        else if (request.Status is not null)
        {
            task.Status = request.Status;
        }

        task.Title       = request.Title;
        task.Description = request.Description;
        task.IsCompleted = request.IsCompleted;
        task.DueDate     = request.DueDate;
        task.UpdatedAt   = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return ToResponse(task);
    }

    public async Task<bool> DeleteAsync(int id, int userId)
    {
        var task = await _db.TaskItems
            .FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId);
        if (task is null) return false;
        _db.TaskItems.Remove(task);
        await _db.SaveChangesAsync();
        return true;
    }

    private static TaskResponse ToResponse(TaskItem t) => new(
        t.Id, t.Title, t.Description,
        t.IsCompleted, t.CreatedAt, t.DueDate, t.UserId,
        t.Status, t.WorkspaceId, t.ColumnId);
}