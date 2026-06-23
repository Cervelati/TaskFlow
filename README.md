# TaskFlow 📋

> Plataforma completa de gerenciamento de tarefas — do pessoal ao empresarial.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Status](https://img.shields.io/badge/status-em%20desenvolvimento-yellow)

---

## Sobre o Projeto

O **TaskFlow** é um sistema de gerenciamento de tarefas desenvolvido como projeto de portfólio e trabalho de conclusão de curso. O objetivo é construir uma aplicação real, escalável e bem documentada, que possa ser utilizada tanto para organização pessoal quanto em contextos empresariais.

O projeto foi pensado para crescer incrementalmente, com cada funcionalidade sendo implementada, testada e documentada de forma rigorosa.

---

## Arquitetura

O sistema é dividido em serviços independentes, orquestrados via Docker:

```
TaskFlow/
├── frontend/             # Interface web (HTML, CSS, JavaScript)
├── backend-api/          # API REST (C# ASP.NET Core 9)
├── notification-service/ # Serviço de notificações (Java Spring Boot)
├── docker-compose.yml    # Orquestração dos serviços
└── README.md
```

---

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Frontend | HTML5, CSS3, JavaScript (vanilla) |
| Backend | C# ASP.NET Core 9, Entity Framework Core |
| Autenticação | JWT (JSON Web Tokens) |
| Notificações | Java 21 + Spring Boot + Maven |
| Banco de dados | PostgreSQL 16 |
| UI/UX | SortableJS (drag-and-drop) |
| Infraestrutura | Docker + Docker Compose |
| Versionamento | Git + GitHub |

---

## Funcionalidades

### ✅ Implementadas

- [x] Autenticação de usuários (cadastro e login com JWT)
- [x] CRUD completo de tarefas (pessoais e em workspaces)
- [x] Proteção de rotas por autenticação
- [x] Dashboard pessoal ("Meu Board") com localStorage
- [x] Workspaces colaborativos com sincronização via API
- [x] Colunas customizáveis (nome, cor, ordem)
- [x] **Drag-and-drop** de colunas e cards (SortableJS)
- [x] Tags e filtros de tarefas
- [x] Visualização de tarefas por status (Todas, Urgentes, Vencendo hoje, Pendentes, Concluídas)
- [x] Modal customizado de exclusão com validação
- [x] Comentários em tarefas
- [x] Checklists dentro de tarefas
- [x] Modo de conclusão (por coluna ou checklist)
- [x] Página de tarefas consolidada (pessoais + workspaces)
- [x] Sincronização automática com API
- [x] Banco de dados PostgreSQL com migrations
- [x] Documentação da API com Swagger

### 🔄 Em desenvolvimento

- [ ] Atribuição de tarefas a usuários específicos
- [ ] Notificações em tempo real (WebSocket)
- [ ] Sistema de permissões detalhado (Owner, Admin, Member, Viewer)
- [ ] Histórico de alterações e auditoria
- [ ] Integração com calendário (iCal)
- [ ] Templates de projetos

### 📋 Planejado

- [ ] Relatórios e análises
- [ ] Integração com serviços externos (Slack, Gmail, etc)
- [ ] Aplicativo mobile (React Native)
- [ ] Sistema de subscrições e planos

---

## Como Rodar o Projeto

### Pré-requisitos

- [Docker](https://www.docker.com/) instalado e rodando
- [Git](https://git-scm.com/) instalado

### Passo a passo

```bash
# Clone o repositório
git clone https://github.com/Cervelati/TaskFlow.git

# Entre na pasta
cd TaskFlow

# Copie o arquivo de variáveis de ambiente
cp .env.example .env

# Edite o .env com suas credenciais
# POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD, JWT_KEY

# Suba todos os serviços
docker compose up
```

### URLs disponíveis

| Serviço | URL |
|---|---|
| Frontend | http://localhost:3000 |
| API | http://localhost:5000 |
| Swagger | http://localhost:5000/swagger/index.html |
| Banco de dados | localhost:5432 |

---

## API Endpoints

### Autenticação

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/register` | Cadastrar novo usuário |
| POST | `/api/auth/login` | Autenticar e obter token JWT |

### Tarefas (requer autenticação)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/tasks` | Listar todas as tarefas do usuário |
| GET | `/api/tasks/{id}` | Buscar tarefa por ID |
| POST | `/api/tasks` | Criar nova tarefa |
| PUT | `/api/tasks/{id}` | Atualizar tarefa |
| DELETE | `/api/tasks/{id}` | Remover tarefa |

### Colunas (requer autenticação)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/columns` | Listar colunas (pessoais ou do workspace) |
| GET | `/api/columns/{id}` | Buscar coluna por ID |
| POST | `/api/columns` | Criar nova coluna |
| PUT | `/api/columns/{id}` | Atualizar coluna (nome, cor, posição) |
| DELETE | `/api/columns/{id}` | Remover coluna |

### Workspaces (requer autenticação)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/workspaces` | Listar workspaces do usuário |
| POST | `/api/workspaces` | Criar novo workspace |
| PUT | `/api/workspaces/{id}` | Atualizar workspace |
| DELETE | `/api/workspaces/{id}` | Remover workspace |

> Para testar os endpoints autenticados, acesse o Swagger em `http://localhost:5000/swagger/index.html`, faça login e clique em **Authorize** para inserir o token JWT.

---

## Estrutura de Dados

### Task

```json
{
  "id": 1,
  "title": "Implementar autenticação",
  "description": "Adicionar JWT ao backend",
  "columnId": 1,
  "workspaceId": null,
  "status": "Em andamento",
  "isCompleted": false,
  "dueDate": "2025-06-30",
  "createdAt": "2025-06-18T12:31:38Z"
}
```

### Column

```json
{
  "id": 1,
  "name": "A fazer",
  "color": "#0065FF",
  "position": 0,
  "workspaceId": null,
  "isFinished": false
}
```

### Workspace

```json
{
  "id": 1,
  "name": "Projeto X",
  "description": "Desenvolvimento do novo sistema",
  "ownerId": 1,
  "createdAt": "2025-06-15T10:20:00Z"
}
```

---

## Variáveis de Ambiente

Copie o `.env.example` para `.env` e preencha os valores:

```env
POSTGRES_DB=taskflow
POSTGRES_USER=seu_usuario
POSTGRES_PASSWORD=sua_senha
JWT_KEY=sua_chave_secreta_com_minimo_32_caracteres
```

---

## Recursos Recentes

### v0.3.0 (Junho 2025)

- ✨ **Drag-and-drop** de colunas e cards usando SortableJS
- 🔧 Migração de referências de coluna de nome para ID (normalização)
- 🐛 Correção de sincronização entre localStorage e API
- 🎨 Modal customizado de exclusão com validação
- ⚡ Atualização visual imediata sem re-render completo

### v0.2.0 (Junho 2025)

- 📊 Dashboard pessoal com localStorage
- 🏢 Workspaces colaborativos
- 💬 Comentários em tarefas
- ☑️ Checklists dentro de tarefas
- 📋 Página consolidada de tarefas

### v0.1.0 (Junho 2025)

- 🔐 Autenticação com JWT
- ✅ CRUD de tarefas
- 📚 Documentação com Swagger

---

## Contexto Acadêmico

Este projeto compõe o Trabalho de Conclusão de Curso (TCC), com foco em demonstrar na prática:

- Arquitetura de microsserviços e monolito com múltiplas camadas
- Desenvolvimento de APIs REST profissionais
- Autenticação segura com JWT
- Conteinerização com Docker
- Integração entre serviços heterogêneos (C# e Java)
- Boas práticas de Git e versionamento
- UI/UX com interações fluidas (drag-and-drop)
- Synchronization e conflito de estado entre frontend e backend

---

## Autor

**Luiz Henrique** — [@Cervelati](https://github.com/Cervelati)

---

## Licença

Distribuído sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.