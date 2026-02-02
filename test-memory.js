import { createRunner } from './dist/index.js';

async function testMemory() {
  console.log('=== 测试记忆功能 ===\n');

  const runner = createRunner();

  // 第一次对话
  console.log('--- 第一次对话 ---');
  const r1 = await runner.run({
    userId: 'test-user',
    message: '我的名字叫李四，我是一名程序员'
  });
  console.log('用户: 我的名字叫李四，我是一名程序员');
  console.log('Agent:', r1.response);
  console.log('会话ID:', r1.sessionId);
  console.log('');

  // 等待一下，确保数据写入
  await new Promise(r => setTimeout(r, 500));

  // 第二次对话 - 同一会话
  console.log('--- 第二次对话 (同一会话) ---');
  const r2 = await runner.run({
    userId: 'test-user',
    sessionId: r1.sessionId,
    message: '我是做什么工作的？'
  });
  console.log('用户: 我是做什么工作的？');
  console.log('Agent:', r2.response);
  console.log('');

  // 第三次对话 - 测试长期记忆
  console.log('--- 测试长期记忆 ---');
  const agent = runner.getAgent(r1.sessionId);
  if (agent) {
    const memoryId = agent.addMemory(
      '用户李四是一名程序员，这是重要的职业信息',
      2.0,
      ['profile', 'career']
    );
    console.log('已添加长期记忆:', memoryId);

    const memories = agent.searchMemories('程序员', 5);
    console.log('搜索"程序员"找到', memories.length, '条记忆');
    if (memories.length > 0) {
      console.log('记忆内容:', memories[0].content);
    }
  }

  console.log('\n=== 测试完成 ===');
  runner.shutdown();
}

testMemory().catch(console.error);
