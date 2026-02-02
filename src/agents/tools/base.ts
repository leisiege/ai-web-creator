/**
 * 工具基类 - 定义所有 Agent 工具的通用接口
 * 参考 clawdbot 的 AgentTool 设计
 */
import type { ToolParameter, ToolContext, ToolCallResult } from '../../utils/types.js';
import { createLogger } from '../../utils/logger.js';

export abstract class AgentTool {
  protected logger = createLogger(`Tool:${this.getName()}`);

  /**
   * 工具名称 - 唯一标识符
   */
  abstract getName(): string;

  /**
   * 工具描述 - 帮助 LLM 理解工具用途
   */
  abstract getDescription(): string;

  /**
   * 工具参数定义
   */
  abstract getParameters(): ToolParameter[];

  /**
   * 执行工具逻辑
   */
  abstract execute(params: Record<string, unknown>, context?: ToolContext): Promise<ToolCallResult>;

  /**
   * 验证参数
   */
  protected validateParams(params: Record<string, unknown>): { valid: boolean; error?: string } {
    const parameters = this.getParameters();

    for (const param of parameters) {
      // 检查必需参数
      if (param.required && !(param.name in params)) {
        return {
          valid: false,
          error: `Missing required parameter: ${param.name}`
        };
      }

      const value = params[param.name];

      // 跳过可选参数的空值检查
      if (value === undefined || value === null) {
        if (!param.required) {
          continue;
        }
        return {
          valid: false,
          error: `Parameter ${param.name} cannot be null or undefined`
        };
      }

      // 类型验证
      if (!this.validateType(value, param.type)) {
        return {
          valid: false,
          error: `Parameter ${param.name} must be of type ${param.type}, got ${typeof value}`
        };
      }
    }

    return { valid: true };
  }

  /**
   * 类型验证
   */
  private validateType(value: unknown, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'array':
        return Array.isArray(value);
      default:
        return true;
    }
  }

  /**
   * 带验证的执行
   */
  async executeSafe(params: Record<string, unknown>, context?: ToolContext): Promise<ToolCallResult> {
    try {
      // 参数验证
      const validation = this.validateParams(params);
      if (!validation.valid) {
        this.logger.warn('Parameter validation failed', { error: validation.error });
        return {
          success: false,
          error: validation.error
        };
      }

      this.logger.debug('Executing tool', { params });
      const result = await this.execute(params, context);
      this.logger.debug('Tool execution completed', { success: result.success });
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Tool execution failed', { error: errorMessage });
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * 获取工具的 JSON Schema 格式定义（用于 LLM 函数调用）
   */
  toJSONSchema(): Record<string, unknown> {
    const parameters = this.getParameters();
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const param of parameters) {
      properties[param.name] = {
        type: param.type,
        description: param.description,
        ...(param.default !== undefined && { default: param.default })
      };

      if (param.required) {
        required.push(param.name);
      }
    }

    return {
      name: this.getName(),
      description: this.getDescription(),
      parameters: {
        type: 'object',
        properties,
        ...(required.length > 0 && { required })
      }
    };
  }
}
