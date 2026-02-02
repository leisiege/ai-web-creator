/**
 * 重试机制 - 指数退避 + 抖动算法
 * 参考 clawdbot 的重试策略
 */
import type { RetryOptions } from './types.js';
import { createLogger } from './logger.js';

const logger = createLogger('Retry');

export interface RetryCondition {
  (error: Error): boolean;
}

export interface RetryOptionsWithCallback extends RetryOptions {
  retryCondition?: RetryCondition;
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * 添加抖动到延迟时间
 * 防止多个请求同时重试造成雷群效应
 */
function addJitter(delay: number): number {
  const jitter = delay * 0.1; // 10% 抖动
  return delay + (Math.random() - 0.5) * 2 * jitter;
}

/**
 * 计算下次重试的延迟时间（指数退避）
 */
function calculateDelay(attempt: number, options: RetryOptionsWithCallback): number {
  let delay = options.initialDelay * Math.pow(options.backoffMultiplier, attempt - 1);
  delay = Math.min(delay, options.maxDelay);

  if (options.jitter) {
    delay = addJitter(delay);
  }

  return delay;
}

/**
 * 判断错误是否可重试
 */
function isRetriableError(error: Error, retryCondition?: RetryCondition): boolean {
  // 网络相关错误通常可重试
  if (error.message.includes('ECONNRESET') ||
      error.message.includes('ETIMEDOUT') ||
      error.message.includes('ENOTFOUND') ||
      error.message.includes('EAI_AGAIN')) {
    return true;
  }

  // HTTP 5xx 错误通常可重试
  if (error.message.includes('5')) {
    return true;
  }

  // HTTP 429 (Too Many Requests) 可重试
  if (error.message.includes('429')) {
    return true;
  }

  // 使用自定义条件
  if (retryCondition) {
    return retryCondition(error);
  }

  return false;
}

/**
 * 带重试的异步函数执行
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptionsWithCallback = {} as RetryOptionsWithCallback
): Promise<T> {
  const opts: Required<RetryOptionsWithCallback> = {
    maxAttempts: options.maxAttempts ?? 3,
    initialDelay: options.initialDelay ?? 1000,
    maxDelay: options.maxDelay ?? 10000,
    backoffMultiplier: options.backoffMultiplier ?? 2,
    jitter: options.jitter ?? true,
    retryCondition: options.retryCondition ?? (() => true),
    onRetry: options.onRetry ?? (() => {}),
  };

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      lastError = err;

      // 最后一次尝试失败，不再重试
      if (attempt >= opts.maxAttempts) {
        logger.error(`All ${opts.maxAttempts} attempts failed`, { error: err.message });
        throw err;
      }

      // 检查是否可重试
      if (!isRetriableError(err, opts.retryCondition)) {
        logger.debug('Error is not retriable, failing immediately', { error: err.message });
        throw err;
      }

      const delay = calculateDelay(attempt, opts);
      logger.debug(`Attempt ${attempt} failed, retrying in ${delay.toFixed(0)}ms`, {
        error: err.message
      });

      opts.onRetry(attempt, err);
      await sleep(delay);
    }
  }

  throw lastError || new Error('Retry failed with unknown error');
}

/**
 * 延迟函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 创建带有重试配置的函数
 */
export function createRetryWrapper<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  options: RetryOptionsWithCallback
): T {
  return (async (...args: Parameters<T>) => {
    return withRetry(() => fn(...args), options);
  }) as T;
}
