# Camille

A tools-enabled, local-first AI personal assistant that runs as a daemon with CLI and Telegram interfaces.

> See [AGENTS.md](AGENTS.md) for architectural decisions and coding conventions.

- **Daemon**: Long-running process that owns state, memory, tools, and permissions
- **CLI**: Connects via Unix socket (`~/.camille/camille.sock`)
- **Telegram**: Bot API with secure pairing (CLI-generated codes)
- **Storage**: SQLite at `~/.camille/camille.db`

## Development

```bash
# Install dependencies
npm install

# Run CLI in development
npm run cli -- --help
npm run cli -- start       # foreground mode (default)

# Type check
npm run build:check
```

## Build

```bash
# Production build (uses tsup)
npm run build

# Run production build
node dist/cli.js --help
```

## Install Globally

```bash
npm run build    # Build first
npm link         # Creates global symlink
```

Now `camille` works from anywhere. Rebuild after changes.

To uninstall: `npm unlink -g camille`

## CLI Commands

```
camille start [-d]       # Start daemon (foreground by default, -d for background)
camille stop             # Stop daemon
camille status           # Check if running
camille chat             # Interactive REPL
camille configure        # Interactive setup wizard
camille pair             # Generate Telegram pairing code
camille allow <path>     # Whitelist directory for read access
camille disallow <path>  # Remove from whitelist
camille paths            # List whitelisted paths
camille reset [--all]    # Wipe database and memory (--all includes config)
```

## Configuration

Create `~/.camille/config.toml`:

```toml
[telegram]
botToken = "your-bot-token"

[llm]
provider = "ollama"  # or "openai"
model = "llama3.2"
apiKey = "sk-..."    # for openai
baseUrl = "http://localhost:11434"  # optional
```

Falls back to defaults if missing or invalid.

## Permissions

Camille runs in a strict sandbox:

- **Write/Delete**: Only inside `~/.camille/`
- **Read/Search**: Only `~/.camille/` + whitelisted paths
- **Whitelist**: CLI-only (`camille allow`), cannot be modified via chat

## Project Structure

```
src/
├── index.ts      # Daemon entry
├── cli/          # CLI entry, IPC client, Ink apps (configure)
├── core/         # Agent, runtime, config, permissions
├── adapters/     # Communication adapters (IPC, Telegram, iMessage)
├── db/           # SQLite connection, schema, repositories
├── llm/          # LLM provider interfaces
├── tools/        # Agent tools (filesystem, etc.)
├── logging/      # Logger (stdout + SQLite sinks)
└── utils/        # Path and crypto helpers
```
