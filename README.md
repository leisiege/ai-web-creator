# AI Web Creator - Simple Agent System

A simplified agent system inspired by [clawdbot](https://github.com/clawbot) design patterns, built with TypeScript and Node.js.

## Features

- **Agent Runner**: Core execution engine for AI agents
- **Memory System**: SQLite-based persistent storage for conversations and knowledge
- **Tool System**: Extensible tool framework with built-in HTTP and web scraping tools
- **Retry Logic**: Exponential backoff with jitter for handling transient failures
- **Configuration Management**: JSON-based configuration with validation

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
├── config/           # Configuration
│   └── config.ts     # Config manager
├── utils/            # Utilities
│   ├── types.ts      # Type definitions
│   ├── logger.ts     # Logging utility
│   ├── retry.ts      # Retry logic
│   └── id.ts         # ID generation
└── index.ts          # Main entry point
```

## Installation

```bash
npm install
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
npm run build
```

## Development

```bash
npm run dev    # Watch mode
npm run lint   # Lint code
```

## Design Principles

This project follows clawdbot's design patterns while simplifying the implementation:

1. **Modular Architecture**: Clean separation of concerns
2. **Type Safety**: Full TypeScript support
3. **Extensibility**: Easy to add new tools and capabilities
4. **Reliability**: Built-in retry mechanisms and error handling
5. **Simplicity**: Focused on core features without over-engineering

## License

MIT
