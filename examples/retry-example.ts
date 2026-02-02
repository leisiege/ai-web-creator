/**
 * 重试机制示例
 * 演示如何使用重试逻辑处理临时故障
 */

import { withRetry, createRetryWrapper, createLogger, LogLevel } from '../src/utils/index.js';

const logger = createLogger('RetryExample', LogLevel.INFO);

// 模拟一个不稳定的 API
class UnstableAPI {
  private attemptCount = 0;

  async fetchData(shouldFail: boolean = true): Promise<string> {
    this.attemptCount++;

    // 前两次调用失败，第三次成功
    if (shouldFail && this.attemptCount < 3) {
      logger.info(`Attempt ${this.attemptCount}: Failing with network error`);
      throw new Error('Network connection failed');
    }

    logger.info(`Attempt ${this.attemptCount}: Success!`);
    return `Data fetched successfully on attempt ${this.attemptCount}`;
  }

  reset(): void {
    this.attemptCount = 0;
  }
}

async function main() {
  logger.info('=== Retry Mechanism Examples ===\n');

  const api = new UnstableAPI();

  // 示例 1: 基础重试
  logger.info('--- Example 1: Basic Retry ---');
  api.reset();

  try {
    const result = await withRetry(
      () => api.fetchData(true),
      {
        maxAttempts: 5,
        initialDelay: 500,
        maxDelay: 3000,
        backoffMultiplier: 2,
        jitter: true,
        onRetry: (attempt, error) => {
          logger.warn(`Retry attempt ${attempt} after error: ${error.message}`);
        }
      }
    );
    logger.info('Result:', result);
  } catch (error) {
    logger.error('All retry attempts failed');
  }

  // 示例 2: 带条件重试
  logger.info('\n--- Example 2: Conditional Retry ---');
  api.reset();

  try {
    const result = await withRetry(
      () => api.fetchData(true),
      {
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 5000,
        backoffMultiplier: 2,
        retryCondition: (error) => {
          // 只对网络错误重试
          const shouldRetry = error.message.includes('Network');
          logger.info(`Checking if "${error.message}" is retriable: ${shouldRetry}`);
          return shouldRetry;
        }
      }
    );
    logger.info('Result:', result);
  } catch (error) {
    logger.error('Failed:', error);
  }

  // 示例 3: 包装函数
  logger.info('\n--- Example 3: Function Wrapper ---');
  api.reset();

  const safeFetch = createRetryWrapper(
    (shouldFail: boolean) => api.fetchData(shouldFail),
    {
      maxAttempts: 3,
      initialDelay: 500,
      maxDelay: 2000
    }
  );

  try {
    const result = await safeFetch(true) as string;
    logger.info('Wrapped function result:', result);
  } catch (error) {
    logger.error('Wrapped function failed:', error);
  }

  // 示例 4: 不同延迟配置的对比
  logger.info('\n--- Example 4: Delay Comparison ---');

  async function testDelays(name: string, config: { jitter: boolean }) {
    const start = Date.now();
    api.reset();

    try {
      await withRetry(
        () => api.fetchData(true),
        {
          maxAttempts: 3,
          initialDelay: 500,
          backoffMultiplier: 2,
          ...config
        }
      );
      const duration = Date.now() - start;
      logger.info(`${name}: ${duration}ms total`);
    } catch (error) {
      logger.error(`${name}: Failed`);
    }
  }

  await testDelays('Without jitter', { jitter: false });
  await testDelays('With jitter', { jitter: true });

  logger.info('\n=== Examples Complete ===');
}

main().catch((error) => {
  logger.error('Example failed:', error);
  process.exit(1);
});
