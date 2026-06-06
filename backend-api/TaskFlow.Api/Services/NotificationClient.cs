using System.Text;
using System.Text.Json;

namespace TaskFlow.Api.Services;

public class NotificationClient
{
    private readonly HttpClient _http;
    private readonly ILogger<NotificationClient> _logger;

    public NotificationClient(HttpClient http, ILogger<NotificationClient> logger)
    {
        _http = http;
        _logger = logger;
    }

    public async Task SendTaskCreatedAsync(int userId, int taskId, string taskTitle)
    {
        try
        {
            var payload = new
            {
                userId,
                taskId,
                type = "TASK_CREATED",
                message = $"Sua tarefa '{taskTitle}' foi criada com sucesso no TaskFlow!"
            };

            var json = JsonSerializer.Serialize(payload);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            await _http.PostAsync("/api/notifications", content);
            _logger.LogInformation("Notificação enviada para tarefa {TaskId}", taskId);
        }
        catch (Exception ex)
        {
            _logger.LogError("Erro ao notificar tarefa {TaskId}: {Error}", taskId, ex.Message);
        }
    }
}