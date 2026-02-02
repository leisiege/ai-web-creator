#!/usr/bin/env node
/**
 * Simple CLI Demo for AI Web Creator
 * 简化的命令行演示程序
 */

import { createRunner } from './index.js';
import { createLogger, LogLevel } from './utils/logger.js';

const logger = createLogger('SimpleCLI', LogLevel.INFO);

// 打印欢迎信息
function printWelcome() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                                                            ║');
  console.log('║          AI Web Creator - Simple Agent Demo               ║');
  console.log('║                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('Features:');
  console.log('  • HTTP Request Tool - Fetch any URL');
  console.log('  • Web Scraper Tool - Extract structured content from web pages');
  console.log('  • SQLite Memory Storage - Persistent conversation history');
  console.log('  • Retry Logic - Exponential backoff with jitter');
  console.log('');
  console.log('────────────────────────────────────────────────────────────');
  console.log('');
}

// 演示示例
async function runDemo() {
  printWelcome();

  const runner = createRunner({
    configPath: './config/agent.config.json'
  });

  const stats = runner.getStats();
  console.log(`✓ Runner initialized with ${stats.toolCount} tools`);
  console.log('');

  // 示例 1: HTTP 请求
  console.log('── Example 1: HTTP Request ────────────────────────────────');
  console.log('');

  let sessionId = '';
  try {
    const result1 = await runner.run({
      userId: 'demo-user',
      message: 'Make a GET request to https://httpbin.org/get?demo=test'
    });

    console.log('Response:', result1.response);
    console.log(`Duration: ${result1.duration}ms`);
    console.log(`Session: ${result1.sessionId}`);
    sessionId = result1.sessionId;
    console.log('');
  } catch (error) {
    console.log('Error:', error instanceof Error ? error.message : String(error));
    console.log('');
  }

  // 示例 2: 网页抓取
  console.log('── Example 2: Web Scraping ────────────────────────────────');
  console.log('');

  try {
    const result2 = await runner.run({
      userId: 'demo-user',
      message: 'Scrape the content from https://example.com and extract metadata'
    });

    console.log('Response:', result2.response);
    console.log(`Duration: ${result2.duration}ms`);
    console.log('');
  } catch (error) {
    console.log('Error:', error instanceof Error ? error.message : String(error));
    console.log('');
  }

  // 显示统计信息
  console.log('── Statistics ─────────────────────────────────────────────');
  console.log('');
  const finalStats = runner.getStats();
  console.log(`Active agents: ${finalStats.activeAgents}`);
  console.log(`Available tools: ${finalStats.toolCount}`);
  console.log('');

  // 获取会话信息
  const agent = runner.getAgent(sessionId);
  if (agent) {
    const sessionInfo = agent.getSessionInfo();
    if (sessionInfo) {
      console.log(`Session created: ${new Date(sessionInfo.createdAt * 1000).toISOString()}`);
      console.log(`Session updated: ${new Date(sessionInfo.updatedAt * 1000).toISOString()}`);
      console.log('');
    }

    // 添加记忆
    const memoryId = agent.addMemory(
      'User prefers web scraping for HTML content extraction',
      1.5,
      ['preference', 'scraping']
    );
    console.log(`✓ Memory added: ${memoryId}`);

    // 搜索记忆
    const memories = agent.searchMemories('scraping', 5);
    console.log(`✓ Found ${memories.length} memories matching "scraping"`);
    console.log('');
  }

  console.log('────────────────────────────────────────────────────────────');
  console.log('');
  console.log('Demo complete! The agent system is ready to use.');
  console.log('');
  console.log('To create your own agent:');
  console.log('  1. Import: import { createRunner } from "./dist/index.js"');
  console.log('  2. Create: const runner = createRunner()');
  console.log('  3. Run: await runner.run({ userId, message })');
  console.log('');

  runner.shutdown();
}

// 运行演示
runDemo().catch((error) => {
  logger.error('Demo failed:', error);
  process.exit(1);
});
