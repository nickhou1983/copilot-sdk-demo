# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack AI conversation platform built on the GitHub Copilot CLI SDK (`@github/copilot-sdk`). Demonstrates custom agents, extensible tools, MCP integration, and a skill system. Node.js 18+ with TypeScript backend, vanilla HTML/CSS/JS frontend, real-time communication via Socket.io.

## Build & Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server with hot-reload (tsx watch)
npm run build        # Compile TypeScript to dist/
npm start            # Run compiled production server
npm run clean        # Remove dist/
```

No automated test suite exists. Verify functionality manually.

### Prerequisites

Requires GitHub Copilot CLI authentication: `gh auth login` + `gh copilot`.

### Running Modes

- **Default (stdio)**: `npm run dev` — SDK auto-starts CLI process
- **Server mode**: Set `COPILOT_CLI_URL=localhost:8080` and start CLI separately with `copilot server --port 8080`

### Environment Variables

- `COPILOT_CLI_URL` — External CLI server endpoint (enables server mode)
- `COPILOT_CLI_PATH` — Custom CLI executable path
- `COPILOT_LOG_LEVEL` — `none|error|warning|info|debug|all`
- `PORT` — App listening port (default 3000)

## Architecture

### Backend (src/)

Three-tier structure:

1. **HTTP/WebSocket Layer** — `src/server.ts`: Express + Socket.io server. Handles 15+ Socket.io event namespaces (sessions, agents, tools, MCP, skills). REST endpoints for file uploads (`/api/upload`) and model listing.

2. **Service Layer** — `src/services/`: Business logic separated by domain.
   - `agentManager.ts` — Agent CRUD + SDK format conversion (`AgentConfig` → `CustomAgentConfig`)
   - `toolRegistry.ts` — Unified tool lookup (builtin + custom tools)
   - `mcpManager.ts` — MCP server config conversion (storage format ↔ SDK format)
   - `skillManager.ts` — Skill directory scanning and file I/O
   - `storage.ts` — JSON file persistence with version numbers and default initialization

3. **SDK Integration Layer** — `src/copilot.ts`: Wraps `CopilotClient` and `CopilotSession`. Manages session lifecycle, event forwarding (message-delta, tool-call, reasoning-delta), user input requests, and permission handling.

### Tool System (src/tools/)

- Builtin tools registered in `src/tools/index.ts` (Map-based registry), implementations in `src/tools/builtin/`
- Custom tools support three handler types: `http_get`, `http_post`, `javascript`
- Custom tool execution logic in `src/tools/customHandler.ts`
- Tool definitions and static configs in `src/tools.ts`
- New builtin tools go in `src/tools/builtin/` and must be registered in `src/tools/index.ts`

### Frontend (public/)

Vanilla JS single-page application with modular managers:
- `public/js/app.js` — Core logic: Socket.io client, session management, message handling
- `public/js/agentManager.js`, `toolManager.js`, `mcpManager.js`, `skillManager.js` — Feature-specific UI modules
- `public/css/style.css` — GitHub-styled design system using CSS variables

### Data Persistence (data/)

JSON file storage, no database. Auto-creates with sample data on first run.
- `data/agents/agents.json` — Agent configurations (versioned)
- `data/tools/custom.json` — Custom tool definitions
- `data/config/mcpServers.json` — MCP server configs
- `data/config/skills.json` — Skills enablement and directory paths
- `data/config/toolGroups.json` — Tool grouping/organization

### Key Data Flow

```
Frontend (Socket.io) → server.ts → Services → Storage (JSON)
                           ↓
                      copilot.ts ↔ GitHub Copilot CLI (stdio or server mode)
```

## Code Conventions

- TypeScript strict mode, ES2022 target, NodeNext module resolution
- ES modules throughout (`"type": "module"` in package.json)
- 2-space indentation, single quotes preferred
- All type definitions centralized in `src/types/agent.ts`
- Socket.io event names must match exactly between frontend and backend
- Comments primarily in English; Chinese supplementary comments are acceptable
- Zod used for runtime schema validation of tool parameters
