/**
 * HTTP 请求工具
 * 支持发送各种 HTTP 请求并获取响应
 */
import { AgentTool } from './base.js';
import type { ToolParameter, ToolContext, ToolCallResult } from '../../utils/types.js';
import { withRetry } from '../../utils/retry.js';

interface HttpRequestOptions {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
  followRedirects?: boolean;
  maxResponseSize?: number;
}

interface HttpResponse {
  statusCode: number;
  statusMessage: string;
  headers: Record<string, string>;
  body: string;
  size: number;
}

export class HttpRequestTool extends AgentTool {
  getName(): string {
    return 'http_request';
  }

  getDescription(): string {
    return 'Send HTTP requests and retrieve responses. Supports GET, POST, PUT, DELETE, PATCH methods with custom headers and body.';
  }

  getParameters(): ToolParameter[] {
    return [
      {
        name: 'url',
        type: 'string',
        description: 'The URL to send the request to',
        required: true
      },
      {
        name: 'method',
        type: 'string',
        description: 'HTTP method to use',
        required: false,
        default: 'GET'
      },
      {
        name: 'headers',
        type: 'object',
        description: 'Custom HTTP headers as key-value pairs',
        required: false
      },
      {
        name: 'body',
        type: 'string',
        description: 'Request body for POST, PUT, PATCH requests',
        required: false
      },
      {
        name: 'timeout',
        type: 'number',
        description: 'Request timeout in milliseconds',
        required: false,
        default: 30000
      },
      {
        name: 'maxResponseSize',
        type: 'number',
        description: 'Maximum response size in bytes',
        required: false,
        default: 10485760 // 10MB
      }
    ];
  }

  async execute(_params: Record<string, unknown>, _context?: ToolContext): Promise<ToolCallResult> {
    const params = _params;
    const options: HttpRequestOptions = {
      url: String(params.url),
      method: ((params.method as string)?.toUpperCase() || 'GET') as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
      headers: params.headers as Record<string, string> | undefined,
      body: params.body as string | undefined,
      timeout: (params.timeout as number) || 30000,
      maxResponseSize: (params.maxResponseSize as number) || 10485760
    };

    // 使用重试机制执行 HTTP 请求
    try {
      const response = await withRetry(
        () => this.fetchWithSizeLimit(options),
        {
          maxAttempts: 3,
          initialDelay: 1000,
          maxDelay: 5000,
          backoffMultiplier: 2,
          jitter: true,
          retryCondition: (error) => {
            // 只对网络错误和 5xx 错误重试
            return error.message.includes('network') ||
                   error.message.includes('timeout') ||
                   error.message.includes('5');
          }
        }
      );

      return {
        success: response.statusCode >= 200 && response.statusCode < 300,
        data: {
          statusCode: response.statusCode,
          statusMessage: response.statusMessage,
          headers: response.headers,
          body: response.body,
          size: response.size
        },
        metadata: {
          url: options.url,
          method: options.method,
          duration: response.headers['x-duration'] as string || 'unknown'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 执行 HTTP 请求并限制响应大小
   */
  private async fetchWithSizeLimit(options: HttpRequestOptions): Promise<HttpResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout);

    try {
      const response = await fetch(options.url, {
        method: options.method,
        headers: options.headers,
        body: options.body,
        signal: controller.signal
      });

      // 获取响应头
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      // 检查内容长度
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > options.maxResponseSize!) {
        throw new Error(`Response too large: ${contentLength} bytes exceeds limit of ${options.maxResponseSize} bytes`);
      }

      // 获取响应体（带大小检查）
      const body = await response.text();
      if (body.length > options.maxResponseSize!) {
        throw new Error(`Response body too large: ${body.length} bytes exceeds limit of ${options.maxResponseSize} bytes`);
      }

      return {
        statusCode: response.status,
        statusMessage: response.statusText,
        headers,
        body,
        size: body.length
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
