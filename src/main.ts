#!/usr/bin/env node
/**
 * AI Web Creator - CLI Entry Point
 * 一个简单的命令行 Agent 程序
 */

import { createRunner } from './index.js';
import { createLogger, LogLevel } from './utils/logger.js';
import { createInterface } from 'readline';

const logger = createLogger('CLI', LogLevel.INFO);

// ANSI 颜色
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function printHeader() {
  console.log('');
  console.log(colors.cyan + colors.bright + '╔═══════════════════════════════════════════════════════╗');
  console.log('║        AI Web Creator - Simple Agent System          ║');
  console.log('║           inspired by clawdbot design                 ║');
  console.log('╚═══════════════════════════════════════════════════════╝' + colors.reset);
  console.log('');
}

function printHelp() {
  console.log(colors.dim + '───────────────────────────────────────────────────────────' + colors.reset);
  console.log(colors.yellow + 'Available Commands:' + colors.reset);
  console.log('  ' + colors.green + '/help' + colors.reset + '       - 显示帮助信息');
  console.log('  ' + colors.green + '/clear' + colors.reset + '      - 清除对话历史');
  console.log('  ' + colors.green + '/stats' + colors.reset + '      - 显示统计信息');
  console.log('  ' + colors.green + '/tools' + colors.reset + '      - 列出可用工具');
  console.log('  ' + colors.green + '/quit' + colors.reset + '       - 退出程序');
  console.log(colors.dim + '───────────────────────────────────────────────────────────' + colors.reset);
  console.log('');
}

function printPrompt() {
  process.stdout.write(colors.bright + colors.blue + '► You: ' + colors.reset);
}

async function main() {
  printHeader();

  // 创建运行器
  const runner = createRunner({
    configPath: './config/agent.config.json'
  });

  const stats = runner.getStats();
  console.log(colors.dim + `✓ Agent runner initialized` + colors.reset);
  console.log(colors.dim + `✓ ${stats.toolCount} tools available` + colors.reset);
  console.log('');

  printHelp();

  // 创建 readline 接口
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  let sessionId = '';

  // 主循环
  const loop = () => {
    printPrompt();

    rl.on('line', async (input) => {
      const message = input.trim();

      if (!message) {
        printPrompt();
        return;
      }

      // 处理命令
      if (message.startsWith('/')) {
        const [command] = message.split(' ');

        switch (command) {
          case '/help':
            printHelp();
            break;
          case '/clear':
            if (sessionId) {
              const agent = runner.getAgent(sessionId);
              if (agent) {
                agent.clearHistory();
                console.log(colors.green + '✓ Conversation history cleared' + colors.reset);
              }
            } else {
              console.log(colors.yellow + '! No active session to clear' + colors.reset);
            }
            break;
          case '/stats':
            const s = runner.getStats();
            console.log(colors.cyan + 'Stats:' + colors.reset);
            console.log(`  Active agents: ${s.activeAgents}`);
            console.log(`  Available tools: ${s.toolCount}`);
            break;
          case '/tools':
            console.log(colors.cyan + 'Available Tools:' + colors.reset);
            console.log('  • ' + colors.green + 'http_request' + colors.reset + ' - Make HTTP requests');
            console.log('  • ' + colors.green + 'web_scraper' + colors.reset + ' - Extract web page content');
            break;
          case '/quit':
          case '/exit':
            console.log(colors.yellow + 'Shutting down...' + colors.reset);
            runner.shutdown();
            process.exit(0);
            break;
          default:
            console.log(colors.red + `! Unknown command: ${command}` + colors.reset);
            console.log(colors.dim + 'Type /help for available commands' + colors.reset);
        }
        printPrompt();
        return;
      }

      // 处理消息
      try {
        const result = await runner.run({
          userId: 'cli-user',
          sessionId: sessionId || undefined,
          message
        });

        sessionId = result.sessionId;
        const duration = result.duration;

        console.log('');
        console.log(colors.bright + colors.cyan + '◇ Agent:' + colors.reset);
        console.log(result.response);
        console.log('');

        console.log(colors.dim + `⏱ ${duration}ms` + colors.reset);
        console.log('');
      } catch (error) {
        console.log(colors.red + '✗ Error: ' + (error instanceof Error ? error.message : String(error)) + colors.reset);
        console.log('');
      }

      printPrompt();
    });

    rl.on('close', () => {
      console.log('');
      console.log(colors.yellow + 'Goodbye!' + colors.reset);
      runner.shutdown();
      process.exit(0);
    });
  };

  // 捕获退出信号
  process.on('SIGINT', () => {
    console.log('');
    console.log(colors.yellow + '\nShutting down...' + colors.reset);
    runner.shutdown();
    process.exit(0);
  });

  loop();
}

main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
