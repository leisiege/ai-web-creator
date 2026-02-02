/**
 * 简单测试脚本 - 检查 Agent 响应
 */

import { createRunner } from './dist/index.js';

async function test() {
  console.log('=== 开始测试 Agent ===\n');

  const runner = createRunner();

  // 测试 1: 普通对话
  console.log('--- 测试 1: 普通对话 ---');
  const r1 = await runner.run({
    userId: 'test',
    message: '你好，请介绍一下你自己'
  });
  console.log('响应:', r1.response);
  console.log('');

  // 测试 2: HTTP 请求
  console.log('--- 测试 2: HTTP 请求 ---');
  const r2 = await runner.run({
    userId: 'test',
    message: '请访问 https://httpbin.org/get'
  });
  console.log('响应:', r2.response);
  console.log('');

  runner.shutdown();
  console.log('=== 测试完成 ===');
}

test().catch(console.error);
