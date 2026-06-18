using Microsoft.EntityFrameworkCore;
using TaskFlow.Api.Data;
using TaskFlow.Api.DTOs;
using TaskFlow.Api.Models;


public class ColumnService
{
    private readonly AppDbContext _db;
    public ColumnService(AppDbContext db) { _db = db; }

    public async Task<List<ColumnResponse>> GetColumnsAsync(int userId, int? workspaceId)
    {
        return await _db.Columns
            .Where(c => c.UserId == userId && c.WorkspaceId == workspaceId)
            .OrderBy(c => c.Position)
            .Select(c => new ColumnResponse(
                c.Id, c.Name, c.Color, c.Position, c.WorkspaceId, c.IsFinished))
            .ToListAsync();
    }

    public async Task<ColumnResponse> CreateColumnAsync(int userId, CreateColumnRequest req)
    {
        var position = await _db.Columns
            .Where(c => c.UserId == userId && c.WorkspaceId == req.WorkspaceId)
            .CountAsync();

        var col = new BoardColumn
        {
            UserId      = userId,
            WorkspaceId = req.WorkspaceId,
            Name        = req.Name.Trim(),
            Color       = req.Color,
            Position    = position,
            IsFinished  = req.IsFinished
        };

        _db.Columns.Add(col);
        await _db.SaveChangesAsync();
        return new ColumnResponse(
            col.Id, col.Name, col.Color, col.Position, col.WorkspaceId, col.IsFinished);
    }

    public async Task<ColumnResponse?> UpdateColumnAsync(int userId, int colId, UpdateColumnRequest req)
    {
        var col = await _db.Columns
            .FirstOrDefaultAsync(c => c.Id == colId && c.UserId == userId);
        if (col is null) return null;

        // Se esta coluna vai ser marcada como finished,
        // desmarca todas as outras do mesmo workspace
        if (req.IsFinished && !col.IsFinished)
        {
            var others = await _db.Columns
                .Where(c => c.UserId == userId
                         && c.WorkspaceId == col.WorkspaceId
                         && c.Id != colId
                         && c.IsFinished)
                .ToListAsync();
            others.ForEach(c => c.IsFinished = false);
        }

        col.Name       = req.Name.Trim();
        col.Color      = req.Color;
        col.Position   = req.Position;
        col.IsFinished = req.IsFinished;

        await _db.SaveChangesAsync();
        return new ColumnResponse(
            col.Id, col.Name, col.Color, col.Position, col.WorkspaceId, col.IsFinished);
    }

    public async Task<DeleteColumnResult> DeleteColumnAsync(int userId, int colId)
    {
        var col = await _db.Columns
            .FirstOrDefaultAsync(c => c.Id == colId && c.UserId == userId);

        if (col is null) return DeleteColumnResult.NotFound;

        var hasTasks = await _db.TaskItems
            .AnyAsync(t => t.ColumnId == colId);

        if (hasTasks) return DeleteColumnResult.HasTasks;

        _db.Columns.Remove(col);
        await _db.SaveChangesAsync();
        return DeleteColumnResult.Success;
    }

    public async Task SeedDefaultColumnsAsync(int userId, int? workspaceId)
    {
        var exists = await _db.Columns
            .AnyAsync(c => c.UserId == userId && c.WorkspaceId == workspaceId);
        if (exists) return;

        var defaults = new[]
        {
            new BoardColumn { UserId = userId, WorkspaceId = workspaceId, Name = "A fazer",
                              Color = "#DFE1E6", Position = 0, IsFinished = false },
            new BoardColumn { UserId = userId, WorkspaceId = workspaceId, Name = "Em andamento",
                              Color = "#0065FF", Position = 1, IsFinished = false },
            new BoardColumn { UserId = userId, WorkspaceId = workspaceId, Name = "Concluído",
                              Color = "#36B37E", Position = 2, IsFinished = true  },
        };
        _db.Columns.AddRange(defaults);
        await _db.SaveChangesAsync();
    }
}