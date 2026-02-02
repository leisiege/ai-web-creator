# AI Web Creator - Simple Agent System

A simplified agent system inspired by [clawdbot](https://github.com/clawbot) design patterns, built with TypeScript and Node.js. Features both CLI and Web interfaces.

## Features

- **Agent Runner**: Core execution engine for AI agents
- **Memory System**: SQLite-based persistent storage for conversations and knowledge
- **Tool System**: Extensible tool framework with built-in HTTP and web scraping tools
- **Retry Logic**: Exponential backoff with jitter for handling transient failures
- **Configuration Management**: JSON-based configuration with validation
- **Web Interface**: React + Vite + TypeScript frontend with REST API
- **Cross-Session Memory**: User-specific memories persist across sessions

## Architecture

```
src/
├── agents/           # Agent system
│   ├── agent.ts      # Core Agent class
│   ├── runner.ts     # Agent execution runner
│   └── tools/        # Tool implementations
│       ├── base.ts   # Tool base class
│       ├── http.ts   # HTTP request tool
│       ├── scraper.ts # Web scraping tool
│       └── index.ts  # Tool registry
├── memory/           # Memory storage
│   ├── store.ts      # SQLite-based memory store
│   └── index.ts
├── web/              # Web server & API
│   ├── server.ts     # Express server entry
│   ├── routes/       # API routes
│   │   ├── chat.ts   # Chat API
│   │   ├── sessions.ts # Session management
│   │   └── memory.ts # Memory query
│   └── types.ts      # Web types
├── config/           # Configuration
│   └── config.ts     # Config manager
├── utils/            # Utilities
│   ├── types.ts      # Type definitions
│   ├── logger.ts     # Logging utility
│   ├── retry.ts      # Retry logic
│   └── id.ts         # ID generation
└── index.ts          # Main entry point

web/                  # Frontend (React + Vite)
├── src/
│   ├── components/   # React components
│   ├── hooks/        # Custom hooks
│   ├── lib/          # API client
│   ├── App.tsx       # Main app
│   └── main.tsx      # Entry point
├── index.html
└── vite.config.ts    # Vite configuration
```

## Installation

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd web && npm install && cd ..
```

## Configuration

Edit `config/agent.config.json` to customize:

```json
{
  "agent": {
    "name": "ai-web-creator-agent",
    "version": "0.1.0"
  },
  "memory": {
    "path": "./data/agent.db"
  },
  "retry": {
    "maxAttempts": 3,
    "initialDelay": 1000
  }
}
```

## Usage

### Web Interface

Start the web server:

```bash
# Build and start backend
npm run build
npm run web
```

The web interface will be available at http://localhost:3000

**Development mode** (with hot-reload):

```bash
# Terminal 1: Backend
npm run dev:web

# Terminal 2: Frontend
cd web && npm run dev
```

Frontend dev server: http://localhost:5173

**API Endpoints:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat` | POST | Send a chat message |
| `/api/sessions` | GET | Get user sessions |
| `/api/sessions/:id` | DELETE | Clear session history |
| `/api/sessions/:id/info` | GET | Get session info |
| `/api/memory` | GET | Search memories |
| `/api/memory` | POST | Add memory |
| `/api/health` | GET | Health check |

### CLI Mode

### Basic Example

```typescript
import { createRunner } from './src/index.js';

const runner = createRunner();

const result = await runner.run({
  userId: 'user-001',
  message: 'Can you fetch https://example.com?'
});

console.log(result.response);
runner.shutdown();
```

### Creating Custom Tools

```typescript
import { AgentTool } from './src/index.js';

class MyTool extends AgentTool {
  getName() { return 'my_tool'; }
  getDescription() { return 'Does something useful'; }
  getParameters() { return [...]; }
  async execute(params, context) { return {...}; }
}

// Register your tool
const registry = new ToolRegistry();
registry.register(new MyTool());
```

### Using Retry Logic

```typescript
import { withRetry } from './src/index.js';

const result = await withRetry(
  async () => await someUnstableOperation(),
  {
    maxAttempts: 3,
    initialDelay: 1000,
    backoffMultiplier: 2,
    jitter: true
  }
);
```

## Built-in Tools

| Tool | Description |
|------|-------------|
| `http_request` | Make HTTP requests with custom headers and body |
| `web_scraper` | Extract structured content from web pages |

## Examples

See the `examples/` directory for more usage examples:

- `basic-usage.ts` - Basic agent usage
- `custom-tool.ts` - Creating custom tools
- `retry-example.ts` - Using retry mechanisms

## Building

```bash
# Build backend
npm run build

# Build frontend (production)
cd web && npm run build
```

## Development

```bash
# Backend development
npm run dev      # Watch mode (TypeScript)
npm run dev:web  # Watch mode with web server
npm run lint     # Lint code

# Frontend development
cd web
npm run dev      # Vite dev server with hot-reload
npm run build    # Production build
npm run preview  # Preview production build
```

## Design Principles

This project follows clawdbot's design patterns while simplifying the implementation:

1. **Modular Architecture**: Clean separation of concerns
2. **Type Safety**: Full TypeScript support
3. **Extensibility**: Easy to add new tools and capabilities
4. **Reliability**: Built-in retry mechanisms and error handling
5. **Simplicity**: Focused on core features without over-engineering
6. **Dual Interface**: Both CLI and Web interfaces for flexibility

## Tech Stack

**Backend:**
- Node.js + TypeScript
- Express (Web server)
- better-sqlite3 (Database)
- Cheerio (Web scraping)

**Frontend:**
- React 18
- Vite
- TypeScript
- Tailwind CSS

**AI/LLM:**
- GLM-4 (智谱AI)
- OpenAI-compatible API support

## License

MIT
