using Microsoft.EntityFrameworkCore;
using TaskFlow.Api.Models;

namespace TaskFlow.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users { get; set; } = null!;
    public DbSet<TaskItem> TaskItems { get; set; } = null!;
    public DbSet<Workspace> Workspaces { get; set; } = null!;
    public DbSet<WorkspaceMember> WorkspaceMembers { get; set; } = null!;
    public DbSet<Invite> Invites { get; set; } = null!;
    public DbSet<BoardColumn> Columns { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Workspace → limite de 3 por usuário (validado no service)
        
        // WorkspaceMember → chave composta
        modelBuilder.Entity<WorkspaceMember>()
            .HasIndex(wm => new { wm.WorkspaceId, wm.UserId })
            .IsUnique();

        // Invite → token único
        modelBuilder.Entity<Invite>()
            .HasIndex(i => i.Token)
            .IsUnique();

        // TaskItem → WorkspaceId nullable
        modelBuilder.Entity<TaskItem>()
            .HasOne(t => t.Workspace)
            .WithMany(w => w.Tasks)
            .HasForeignKey(t => t.WorkspaceId)
            .OnDelete(DeleteBehavior.SetNull);
    }
    
}