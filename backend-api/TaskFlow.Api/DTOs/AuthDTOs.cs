namespace TaskFlow.Api.DTOs;

public record RegisterRequest(
    string Name,
    string Email,
    string Password
);

public record LoginRequest(
    string Email,
    string Password
);

public record AuthResponse(
    int Id,
    string Name,
    string Email,
    string Token,
    string Plan
);

public record UpdateProfileRequest(string Name, string Email);
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
public record DeleteAccountRequest(string Password);