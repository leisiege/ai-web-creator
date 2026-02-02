/**
 * 自定义工具示例
 * 演示如何创建和使用自定义 Agent 工具
 */

import { AgentTool } from '../src/agents/tools/base.js';
import type { ToolParameter, ToolContext, ToolCallResult } from '../src/utils/types.js';
import { createRunner, ToolRegistry } from '../src/index.js';
import { createLogger, LogLevel } from '../src/utils/logger.js';

const logger = createLogger('CustomToolExample', LogLevel.INFO);

/**
 * 自定义计算器工具
 */
class CalculatorTool extends AgentTool {
  getName(): string {
    return 'calculator';
  }

  getDescription(): string {
    return 'Perform basic mathematical calculations: add, subtract, multiply, divide';
  }

  getParameters(): ToolParameter[] {
    return [
      {
        name: 'operation',
        type: 'string',
        description: 'The operation to perform: add, subtract, multiply, divide',
        required: true
      },
      {
        name: 'a',
        type: 'number',
        description: 'First number',
        required: true
      },
      {
        name: 'b',
        type: 'number',
        description: 'Second number',
        required: true
      }
    ];
  }

  async execute(
    params: Record<string, unknown>,
    context?: ToolContext
  ): Promise<ToolCallResult> {
    const operation = params.operation as string;
    const a = params.a as number;
    const b = params.b as number;

    let result: number;
    switch (operation) {
      case 'add':
        result = a + b;
        break;
      case 'subtract':
        result = a - b;
        break;
      case 'multiply':
        result = a * b;
        break;
      case 'divide':
        if (b === 0) {
          return {
            success: false,
            error: 'Division by zero is not allowed'
          };
        }
        result = a / b;
        break;
      default:
        return {
          success: false,
          error: `Unknown operation: ${operation}`
        };
    }

    return {
      success: true,
      data: {
        operation,
        a,
        b,
        result
      },
      metadata: {
        userId: context?.userId,
        sessionId: context?.sessionId
      }
    };
  }
}

/**
 * 自定义时间工具
 */
class TimeTool extends AgentTool {
  getName(): string {
    return 'current_time';
  }

  getDescription(): string {
    return 'Get the current date and time in various formats';
  }

  getParameters(): ToolParameter[] {
    return [
      {
        name: 'timezone',
        type: 'string',
        description: 'Timezone identifier (e.g., UTC, America/New_York)',
        required: false,
        default: 'UTC'
      },
      {
        name: 'format',
        type: 'string',
        description: 'Output format: iso, unix, readable',
        required: false,
        default: 'iso'
      }
    ];
  }

  async execute(
    params: Record<string, unknown>,
    context?: ToolContext
  ): Promise<ToolCallResult> {
    const timezone = (params.timezone as string) || 'UTC';
    const format = (params.format as string) || 'iso';

    const now = new Date();

    let output: string;
    switch (format) {
      case 'iso':
        output = now.toISOString();
        break;
      case 'unix':
        output = Math.floor(now.getTime() / 1000).toString();
        break;
      case 'readable':
        output = now.toLocaleString('en-US', { timeZone: timezone });
        break;
      default:
        output = now.toISOString();
    }

    return {
      success: true,
      data: {
        timezone,
        format,
        datetime: output
      }
    };
  }
}

async function main() {
  logger.info('=== Custom Tool Example ===\n');

  // 1. 创建工具注册表并注册自定义工具
  const toolRegistry = new ToolRegistry();
  toolRegistry.register(new CalculatorTool());
  toolRegistry.register(new TimeTool());

  logger.info('Registered custom tools:', toolRegistry.getToolNames());
  logger.info('\nTool schemas:');
  toolRegistry.getSchemas().forEach(schema => {
    logger.info(JSON.stringify(schema, null, 2));
  });

  // 2. 使用自定义工具注册表创建运行器
  const runner = createRunner({ toolRegistry });

  // 3. 测试计算器工具
  logger.info('\n--- Testing Calculator ---');
  const calcResult = await runner.run({
    userId: 'user-001',
    message: 'What is 123 multiplied by 456?'
  });
  logger.info('Response:', calcResult.response);

  // 4. 测试时间工具
  logger.info('\n--- Testing Time Tool ---');
  const timeResult = await runner.run({
    userId: 'user-001',
    sessionId: calcResult.sessionId,
    message: 'What is the current time in readable format?'
  });
  logger.info('Response:', timeResult.response);

  // 5. 清理
  runner.shutdown();
  logger.info('\nExample completed');
}

main().catch((error) => {
  logger.error('Example failed:', error);
  process.exit(1);
});
