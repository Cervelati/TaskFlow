using Microsoft.EntityFrameworkCore;
using TaskFlow.Api.Data;
using TaskFlow.Api.DTOs;
using TaskFlow.Api.Models;

namespace TaskFlow.Api.Services;

public class TaskService
{
    private readonly AppDbContext _db;

    public TaskService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<List<TaskResponse>> GetAllAsync(int userId)
    {
        return await _db.TaskItems
            .Where(t => t.UserId == userId)
            .OrderByDescending(t => t.CreatedAt)
            .Select(t => ToResponse(t))
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
        var task = new TaskItem
        {
            Title = request.Title,
            Description = request.Description,
            DueDate = request.DueDate,
            UserId = userId
        };

        _db.TaskItems.Add(task);
        await _db.SaveChangesAsync();

        return ToResponse(task);
    }

    public async Task<TaskResponse?> UpdateAsync(int id, UpdateTaskRequest request, int userId)
    {
        var task = await _db.TaskItems
            .FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId);

        if (task is null) return null;

        task.Title = request.Title;
        task.Description = request.Description;
        task.IsCompleted = request.IsCompleted;
        task.DueDate = request.DueDate;

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
        t.IsCompleted, t.CreatedAt, t.DueDate, t.UserId
    );
}