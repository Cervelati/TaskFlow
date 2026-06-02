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
├── frontend/            # Interface web (HTML, CSS, JavaScript)
├── backend-api/         # API REST (C# ASP.NET Core)
├── notification-service/ # Serviço de notificações (Java Spring Boot)
├── docker-compose.yml   # Orquestração dos serviços
└── README.md
```

---

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Frontend | HTML5, CSS3, JavaScript |
| Backend | C# ASP.NET Core |
| Notificações | Java Spring Boot |
| Banco de dados | A definir |
| Infraestrutura | Docker, Docker Compose |
| Versionamento | Git + GitHub |

---

## Funcionalidades Planejadas

- [ ] Autenticação de usuários (login/cadastro)
- [ ] Criação, edição e exclusão de tarefas
- [ ] Atribuição de tarefas a usuários
- [ ] Definição de prazo e prioridade
- [ ] Status de tarefas (pendente, em andamento, concluído)
- [ ] Notificações de prazo e atualizações
- [ ] Dashboard com visão geral das tarefas
- [ ] Filtros e busca

---

## Como Rodar o Projeto

### Pré-requisitos

- [Docker](https://www.docker.com/) instalado
- [Git](https://git-scm.com/) instalado

### Passo a passo

```bash
# Clone o repositório
git clone https://github.com/Cervelati/TaskFlow.git

# Entre na pasta
cd TaskFlow

# Suba todos os serviços
docker-compose up
```

> **Nota:** instruções detalhadas de cada serviço serão adicionadas conforme o desenvolvimento avança.

---

## Contexto Acadêmico

Este projeto também compõe o Trabalho de Conclusão de Curso, com foco em demonstrar na prática conceitos de:

- Arquitetura de microsserviços
- Desenvolvimento de APIs REST
- Conteinerização com Docker
- Integração entre serviços com tecnologias diferentes (C# e Java)
- Boas práticas de versionamento com Git

---

## Autor

**Luiz Henrique** — [@Cervelati](https://github.com/Cervelati)

---

## Licença

Distribuído sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.
