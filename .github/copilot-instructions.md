# Project Guidelines

Full-stack AI conversation platform on `@github/copilot-sdk`. TypeScript backend (Node.js 18+, Express, Socket.io), vanilla JS frontend.

## Build & Run

```bash
npm install && npm run dev   # Dev server with hot-reload (tsx watch)
npm run build && npm start   # Production (tsc → dist/)
COPILOT_LOG_LEVEL=debug npm run dev  # Verbose SDK event logging
```

Prerequisite: `gh auth login` + `gh copilot` for CLI authentication. No test suite — verify manually.

## Architecture

Three-tier backend in `src/`:

1. **HTTP/WebSocket** (`server.ts`) — Express + Socket.io, 15+ event namespaces, REST for uploads/models
2. **Services** (`services/`) — Domain logic: `agentManager`, `toolRegistry`, `mcpManager`, `skillManager`, `storage`
3. **SDK Integration** (`copilot.ts`) — Wraps `CopilotClient`/`CopilotSession`, manages lifecycle, event forwarding, permission handling

Frontend: vanilla JS SPA in `public/`, one manager module per feature (`agentManager.js`, `toolManager.js`, `mcpManager.js`, `skillManager.js`), core logic in `app.js`.

Data: JSON files in `data/` (no database). Auto-creates with defaults on first run. Each file has a version field.

## Critical Patterns

### Two-Format Type Conversion

Storage types (`AgentConfig` in `src/types/agent.ts`) differ from SDK types (`CustomAgentConfig`). Conversion in `agentManager.ts`:
- `tools: null` in storage = "use all tools" → becomes `undefined` for SDK
- `mcpServerIds` (string references) → resolved to full `MCPServerConfig` objects via `getMCPServersByIds()`
- UI metadata (`icon`, `color`, `preferredModel`, `isDefault`) and `systemMessage`/`permissionPolicy`/`infiniteSession` are stripped during SDK conversion
- Only agents with non-empty `prompt` are included in SDK output

### Adding a Builtin Tool

New tools go in `src/tools/builtin/` and MUST be registered in **both** exports in `src/tools/index.ts`:
1. `builtinToolsMap` (Map: string ID → tool instance, used at runtime)
2. `builtinToolsInfo` (array of `{id, name, description, parameters}`, used for UI)

Missing from either breaks the tool silently.

### Socket.io Event Pattern

All events follow: `socket.on(event) → validate → call service → socket.emit(response)`.
- Response events: `"agents-list"`, `"agent-created"`, etc. Always include `{ success: boolean }`.
- Async handlers (e.g., `send-message`) use session-scoped naming: `user-input-response:${sessionId}`
- Use `socket.once()` not `socket.on()` for single-use response listeners
- Permission/input handlers MUST be set before `sendMessage()` and cleared in `finally`

### Custom Tool Handler Types

Three types in `src/tools/customHandler.ts`:
- `http_get` / `http_post`: URL templates with `{{paramName}}` interpolation, optional `resultPath` for JSONPath extraction
- `javascript`: Executed via `AsyncFunction` constructor — only `fetch` and `args` (serialized params) available in scope. No `console`, `process`, or Node APIs.

### Storage Conventions

- `readJsonFile()` returns defaults silently on missing/error — no throw
- `createdAt` set only on INSERT; `updatedAt` always set on save
- Default agent (`isDefault: true`) cannot be deleted
- Agent names: 2-50 chars, `[a-zA-Z0-9_-]` only, must start with letter

## Code Style

- TypeScript strict mode, ES2022 target, NodeNext module resolution, ES modules (`"type": "module"`)
- 2-space indent, single quotes preferred
- All type definitions centralized in `src/types/agent.ts`
- Zod for runtime schema validation of tool parameters
- Comments in English; Chinese supplementary comments acceptable
- Socket.io event names must match exactly between frontend (`public/js/`) and backend (`src/server.ts`)
