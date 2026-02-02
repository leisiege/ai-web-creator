/**
 * ID 生成工具
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

export function generateShortId(): string {
  return Math.random().toString(36).substring(2, 10);
}
