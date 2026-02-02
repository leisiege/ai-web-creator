import { AgentRunner } from './dist/index.js';

async function testMemoryExpiry() {
  console.log('=== 测试记忆过期功能 ===\n');

  const runner = new AgentRunner();

  // 获取记忆过期配置
  const agent = runner.getAgent('test-user-expiry');
  if (!agent) {
    console.log('创建新 Agent...');
  }

  // 1. 添加一些测试记忆
  console.log('--- 添加测试记忆 ---');
  const testRunner = new AgentRunner();
  const r1 = await testRunner.run({
    userId: 'test-expiry-user',
    message: '我叫测试用户，职业是工程师，住在北京'
  });
  console.log('用户: 我叫测试用户，职业是工程师，住在北京');
  console.log('Agent:', r1.response.substring(0, 80));

  // 手动添加更多记忆
  const testAgent = testRunner.getAgent(r1.sessionId);
  if (testAgent) {
    for (let i = 0; i < 10; i++) {
      testAgent.addMemory(`测试记忆 ${i}: 一些测试信息`, 1.0, ['test']);
    }
    console.log('已添加 10 条测试记忆');
  }

  testRunner.shutdown();

  // 等待一下
  await new Promise(r => setTimeout(r, 1000));

  // 2. 查看当前记忆数量
  console.log('\n--- 查看记忆数量 ---');
  const runner2 = new AgentRunner();
  const r2 = await runner2.run({
    userId: 'test-expiry-user',
    message: '我是什么职业？'
  });
  console.log('用户: 我是什么职业？');
  console.log('Agent:', r2.response);

  const agent2 = runner2.getAgent(r2.sessionId);
  if (agent2) {
    const memories = agent2.searchMemories('', 100);
    console.log(`当前记忆数量: ${memories.length}`);
    console.log('记忆列表:');
    memories.slice(0, 5).forEach(m => {
      console.log(`  - ${m.content.substring(0, 40)}... (importance: ${m.importance})`);
    });
  }

  runner2.shutdown();

  // 3. 测试手动清理
  console.log('\n--- 测试手动清理 ---');
  const runner3 = new AgentRunner();
  const r3 = await runner3.run({
    userId: 'test-expiry-user',
    message: '你好'
  });

  // 修改配置为更低的限制进行测试
  const agent3 = runner3.getAgent(r3.sessionId);
  if (agent3) {
    const memories = agent3.searchMemories('', 100);
    console.log(`清理前记忆数量: ${memories.length}`);

    // 测试清理功能（这里只是测试 API 是否存在）
    console.log('记忆过期配置:', agent3.getSessionInfo());
  }

  runner3.shutdown();

  console.log('\n=== 测试完成 ===');
}

testMemoryExpiry().catch(console.error);
