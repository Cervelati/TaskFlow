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
    public async Task SendInviteEmailAsync(string toEmail, string workspaceName, string inviteLink, DateTime expiresAt)
    {
        try
        {
            var payload = new
            {
                to = toEmail,
                subject = $"Você foi convidado para o workspace \"{workspaceName}\" no TaskFlow",
                body = $"""
                Olá!

                Você recebeu um convite para colaborar no workspace "{workspaceName}" no TaskFlow.

                Clique no link abaixo para aceitar o convite:
                {inviteLink}

                Este convite expira em {expiresAt:dd/MM/yyyy HH:mm} UTC.

                Se você não esperava este convite, pode ignorar este e-mail.

                — Equipe TaskFlow
                """
            };

            await _httpClient.PostAsJsonAsync("/notify/email", payload);
        }
        catch (Exception ex)
        {
            // Log sem quebrar o fluxo principal
            Console.WriteLine($"[NotificationClient] Falha ao enviar convite: {ex.Message}");
        }
    }
}