import { AgentRunner } from './dist/index.js';

async function testCrossSessionMemory() {
  console.log('=== 测试跨会话记忆功能 ===\n');

  // 第一次运行 - 创建记忆
  console.log('--- 第一次运行 ---');
  const runner1 = new AgentRunner();

  const r1 = await runner1.run({
    userId: 'test-user-cross-session',
    message: '我的名字叫王五，最喜欢的颜色是蓝色，我住在上海'
  });
  console.log('用户: 我的名字叫王五，最喜欢的颜色是蓝色，我住在上海');
  console.log('Agent:', r1.response.substring(0, 80));
  console.log('会话ID:', r1.sessionId);

  // 手动添加重要记忆
  const agent1 = runner1.getAgent(r1.sessionId);
  if (agent1) {
    agent1.addMemory('用户王五：最喜欢的颜色是蓝色，居住在上海', 2.5, ['preference', 'location']);
    console.log('已添加长期记忆');
  }

  runner1.shutdown();
  console.log('');

  // 等待一下，确保数据库完全关闭
  await new Promise(r => setTimeout(r, 1000));

  // 第二次运行 - 新会话，应该能记住之前的记忆
  console.log('--- 第二次运行（新会话） ---');
  const runner2 = new AgentRunner();

  const r2 = await runner2.run({
    userId: 'test-user-cross-session',
    message: '我最喜欢什么颜色？'
  });
  console.log('用户: 我最喜欢什么颜色？');
  console.log('Agent:', r2.response);
  console.log('');

  runner2.shutdown();
  console.log('=== 测试完成 ===');
}

testCrossSessionMemory().catch(console.error);
