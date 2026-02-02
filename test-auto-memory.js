import { AgentRunner } from './dist/index.js';

async function testAutoMemory() {
  console.log('=== 测试自动记忆功能 ===\n');

  // 第一次运行 - 告诉 Agent 你的职业
  console.log('--- 第一次运行 ---');
  const runner1 = new AgentRunner();

  const r1 = await runner1.run({
    userId: 'auto-test-user',
    message: '我是程序员，住在深圳'
  });
  console.log('用户: 我是程序员，住在深圳');
  console.log('Agent:', r1.response.substring(0, 100));
  console.log('会话:', r1.sessionId);

  // 等待异步记忆保存
  await new Promise(r => setTimeout(r, 4000));

  // 检查记忆
  const agent1 = runner1.getAgent(r1.sessionId);
  if (agent1) {
    const memories = agent1.searchMemories('', 20);
    console.log('已保存记忆数量:', memories.length);
    memories.forEach(m => {
      console.log('  -', m.content.substring(0, 60));
    });
  }

  runner1.shutdown();
  console.log('');

  // 等待数据库完全关闭
  await new Promise(r => setTimeout(r, 2000));

  // 第二次运行 - 新会话，应该自动加载之前的记忆
  console.log('--- 第二次运行（新会话 - 模拟重启） ---');
  const runner2 = new AgentRunner();

  const r2 = await runner2.run({
    userId: 'auto-test-user',
    message: '我的职业是什么？'
  });
  console.log('用户: 我的职业是什么？');
  console.log('Agent:', r2.response);
  console.log('');

  runner2.shutdown();
  console.log('=== 测试完成 ===');
}

testAutoMemory().catch(console.error);
