using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TaskFlow.Api.DTOs;
using TaskFlow.Api.Services;

namespace TaskFlow.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly AuthService _authService;

    public AuthController(AuthService authService)
    {
        _authService = authService;
    }

    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    /// <summary>Cadastra um novo usuário</summary>
    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest request)
    {
        var result = await _authService.RegisterAsync(request);
        if (result is null)
            return Conflict(new { message = "E-mail já cadastrado." });
        return CreatedAtAction(nameof(Register), result);
    }

    /// <summary>Autentica um usuário e retorna o token JWT</summary>
    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        var result = await _authService.LoginAsync(request);
        if (result is null)
            return Unauthorized(new { message = "E-mail ou senha inválidos." });
        return Ok(result);
    }

    /// <summary>Atualiza nome e email do usuário autenticado</summary>
    [HttpPut("profile")]
    [Authorize]
    public async Task<IActionResult> UpdateProfile(UpdateProfileRequest request)
    {
        var result = await _authService.UpdateProfileAsync(UserId, request);
        if (result is null)
            return Conflict(new { message = "E-mail já está em uso." });
        return Ok(result);
    }

    /// <summary>Altera a senha do usuário autenticado</summary>
    [HttpPut("password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request)
    {
        var ok = await _authService.ChangePasswordAsync(UserId, request);
        if (!ok)
            return BadRequest(new { message = "Senha atual incorreta." });
        return Ok(new { message = "Senha alterada com sucesso." });
    }

    /// <summary>Exclui a conta do usuário autenticado</summary>
    [HttpDelete("account")]
    [Authorize]
    public async Task<IActionResult> DeleteAccount(DeleteAccountRequest request)
    {
        var ok = await _authService.DeleteAccountAsync(UserId, request.Password);
        if (!ok)
            return BadRequest(new { message = "Senha incorreta." });
        return Ok(new { message = "Conta excluída com sucesso." });
    }
}