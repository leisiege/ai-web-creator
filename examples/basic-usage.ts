/**
 * 基础使用示例
 * 演示如何使用 AI Web Creator Agent 系统
 */

import { createRunner } from '../src/index.js';
import { createLogger, LogLevel } from '../src/utils/logger.js';

// 设置日志级别
const logger = createLogger('Example', LogLevel.INFO);

async function main() {
  logger.info('=== AI Web Creator - Basic Usage Example ===\n');

  // 1. 创建运行器
  const runner = createRunner({
    configPath: './config/agent.config.json'
  });

  logger.info('Runner created successfully');
  logger.info('Available tools:', runner.getStats().toolCount);

  // 2. 示例对话 - 发送 HTTP 请求
  logger.info('\n--- Example 1: HTTP Request ---');
  const result1 = await runner.run({
    userId: 'user-001',
    message: 'Can you make an HTTP GET request to https://httpbin.org/get?test=123'
  });

  logger.info('Response:', result1.response);
  logger.info('Duration:', result1.duration + 'ms');

  // 3. 示例对话 - 网页抓取
  logger.info('\n--- Example 2: Web Scraping ---');
  const result2 = await runner.run({
    userId: 'user-001',
    sessionId: result1.sessionId, // 使用相同会话
    message: 'Please scrape the content from https://example.com and extract the title and metadata'
  });

  logger.info('Response:', result2.response);
  logger.info('Duration:', result2.duration + 'ms');

  // 4. 获取 Agent 统计信息
  logger.info('\n--- Agent Statistics ---');
  const stats = runner.getStats();
  logger.info('Active agents:', stats.activeAgents);
  logger.info('Available tools:', stats.toolCount);

  // 5. 使用 Agent 添加记忆
  logger.info('\n--- Memory Operations ---');
  const agent = runner.getAgent(result1.sessionId);
  if (agent) {
    const memoryId = agent.addMemory(
      'User prefers HTTP requests over web scraping for JSON APIs',
      1.5,
      ['preference', 'api']
    );
    logger.info('Memory added:', memoryId);

    // 搜索记忆
    const memories = agent.searchMemories('HTTP', 5);
    logger.info('Found memories:', memories.length);
  }

  // 6. 清理
  logger.info('\n--- Cleanup ---');
  runner.shutdown();
  logger.info('Runner shutdown complete');
}

// 错误处理
main().catch((error) => {
  logger.error('Example failed:', error);
  process.exit(1);
});
