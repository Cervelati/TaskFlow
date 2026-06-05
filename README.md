# TaskFlow 📋

> Plataforma completa de gerenciamento de tarefas — do pessoal ao empresarial.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Status](https://img.shields.io/badge/status-em%20desenvolvimento-yellow)

---

## Sobre o Projeto

O **TaskFlow** é um sistema de gerenciamento de tarefas desenvolvido como projeto de portfólio e trabalho de conclusão de curso. O objetivo é construir uma aplicação real, escalável e bem documentada, que possa ser utilizada tanto para organização pessoal quanto em contextos empresariais e didáticos.

O projeto foi pensado para crescer aos poucos, com cada funcionalidade sendo implementada, testada e documentada de forma incremental.

---

## Arquitetura

O sistema é dividido em serviços independentes, orquestrados via Docker:

```
TaskFlow/
├── frontend/             # Interface web (HTML, CSS, JavaScript)
├── backend-api/          # API REST (C# ASP.NET Core)
├── notification-service/ # Serviço de notificações (Java Spring Boot)
├── docker-compose.yml    # Orquestração dos serviços
└── README.md
```

---

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Frontend | HTML5, CSS3, JavaScript |
| Backend | C# ASP.NET Core 9 |
| Autenticação | JWT (JSON Web Tokens) |
| Notificações | Java 21 + Spring Boot + Maven |
| Banco de dados | PostgreSQL 16 |
| Documentação | Swagger / OpenAPI |
| Infraestrutura | Docker + Docker Compose |
| Versionamento | Git + GitHub |

---

## Funcionalidades

- [x] Autenticação de usuários (cadastro e login com JWT)
- [x] CRUD completo de tarefas
- [x] Proteção de rotas por autenticação
- [x] Documentação da API com Swagger
- [x] Banco de dados PostgreSQL com migrations
- [x] Orquestração completa via Docker Compose
- [ ] Atribuição de tarefas a usuários
- [ ] Prioridade e status de tarefas (pendente, em andamento, concluído)
- [ ] Notificações de prazo e atualizações
- [ ] Dashboard com visão geral das tarefas
- [ ] Filtros e busca

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

> Para testar os endpoints autenticados, acesse o Swagger em `http://localhost:5000/swagger/index.html`, faça login e clique em **Authorize** para inserir o token JWT.

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

## Contexto Acadêmico

Este projeto também compõe o Trabalho de Conclusão de Curso, com foco em demonstrar na prática conceitos de:

- Arquitetura de microsserviços
- Desenvolvimento de APIs REST
- Autenticação segura com JWT
- Conteinerização com Docker
- Integração entre serviços com tecnologias diferentes (C# e Java)
- Boas práticas de versionamento com Git

---

## Autor

**Luiz Henrique** — [@Cervelati](https://github.com/Cervelati)

---

## Licença

Distribuído sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.
