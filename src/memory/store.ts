/**
 * SQLite 记忆存储系统
 * 参考 clawdbot 的混合存储设计，简化实现
 */
import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import type { Message } from '../utils/types.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('MemoryStore');

export interface SessionInfo {
  id: string;
  userId: string;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
}

export interface MemoryRecord {
  id: string;
  sessionId?: string;
  content: string;
  importance: number;
  accessCount: number;
  tags?: string[];
  createdAt: number;
  accessedAt: number;
}

export interface ToolCallRecord {
  id: string;
  sessionId: string;
  messageId?: string;
  toolName: string;
  parameters: Record<string, unknown>;
  result?: unknown;
  success: boolean;
  durationMs?: number;
  timestamp: number;
}

export class MemoryStore {
  private db: Database.Database;
  private stmts: Map<string, Database.Statement> = new Map();

  constructor(dbPath: string) {
    // 确保数据目录存在
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      logger.info(`Created data directory: ${dir}`);
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this.initializeSchema();
    this.prepareStatements();

    logger.info(`Memory store initialized: ${dbPath}`);
  }

  /**
   * 初始化数据库 Schema
   */
  private initializeSchema(): void {
    const schema = `
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        metadata TEXT
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('system', 'user', 'assistant', 'tool')),
        content TEXT NOT NULL,
        tool_call_id TEXT,
        tool_name TEXT,
        timestamp INTEGER NOT NULL,
        tokens INTEGER,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        user_id TEXT,
        content TEXT NOT NULL,
        embedding BLOB,
        importance REAL DEFAULT 1.0,
        access_count INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        accessed_at INTEGER NOT NULL,
        tags TEXT
      );

      CREATE TABLE IF NOT EXISTS tool_calls (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        message_id TEXT,
        tool_name TEXT NOT NULL,
        parameters TEXT NOT NULL,
        result TEXT,
        success INTEGER NOT NULL DEFAULT 0,
        duration_ms INTEGER,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(session_id, role);
      CREATE INDEX IF NOT EXISTS idx_memories_session ON memories(session_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance DESC, accessed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_tool_calls_session ON tool_calls(session_id, timestamp);
    `;

    this.db.exec(schema);
    logger.debug('Database schema initialized');
  }

  /**
   * 准备常用 SQL 语句
   */
  private prepareStatements(): void {
    const statements = {
      // Session
      createSession: this.db.prepare(`
        INSERT INTO sessions (id, user_id, created_at, updated_at, metadata)
        VALUES (?, ?, ?, ?, ?)
      `),
      getSession: this.db.prepare(`
        SELECT id, user_id, created_at, updated_at, metadata
        FROM sessions WHERE id = ?
      `),
      updateSession: this.db.prepare(`
        UPDATE sessions SET updated_at = ?, metadata = ? WHERE id = ?
      `),
      deleteSession: this.db.prepare(`DELETE FROM sessions WHERE id = ?`),

      // Messages
      addMessage: this.db.prepare(`
        INSERT INTO messages (id, session_id, role, content, tool_call_id, tool_name, timestamp, tokens)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `),
      getMessages: this.db.prepare(`
        SELECT id, session_id, role, content, tool_call_id, tool_name, timestamp, tokens
        FROM messages WHERE session_id = ? ORDER BY timestamp ASC
      `),
      getRecentMessages: this.db.prepare(`
        SELECT id, session_id, role, content, tool_call_id, tool_name, timestamp, tokens
        FROM messages WHERE session_id = ? ORDER BY timestamp DESC LIMIT ?
      `),
      deleteMessages: this.db.prepare(`DELETE FROM messages WHERE session_id = ?`),

      // Memories
      addMemory: this.db.prepare(`
        INSERT INTO memories (id, session_id, content, importance, access_count, created_at, accessed_at, tags)
        VALUES (?, ?, ?, ?, 0, ?, ?, ?)
      `),
      getMemory: this.db.prepare(`SELECT * FROM memories WHERE id = ?`),
      getMemoriesBySession: this.db.prepare(`
        SELECT * FROM memories WHERE session_id = ? ORDER BY created_at DESC
      `),
      getImportantMemories: this.db.prepare(`
        SELECT * FROM memories WHERE session_id = ? OR session_id IS NULL
        ORDER BY importance DESC, accessed_at DESC LIMIT ?
      `),
      updateMemoryAccess: this.db.prepare(`
        UPDATE memories SET access_count = access_count + 1, accessed_at = ? WHERE id = ?
      `),
      deleteMemory: this.db.prepare(`DELETE FROM memories WHERE id = ?`),

      // Tool calls
      addToolCall: this.db.prepare(`
        INSERT INTO tool_calls (id, session_id, message_id, tool_name, parameters, result, success, duration_ms, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),
      getToolCalls: this.db.prepare(`
        SELECT * FROM tool_calls WHERE session_id = ? ORDER BY timestamp DESC
      `),
    };

    for (const [name, stmt] of Object.entries(statements)) {
      this.stmts.set(name, stmt);
    }

    logger.debug('Prepared SQL statements');
  }

  // ========== Session Methods ==========

  createSession(sessionId: string, userId: string, metadata?: Record<string, unknown>): void {
    const now = Math.floor(Date.now() / 1000);
    const metadataJson = metadata ? JSON.stringify(metadata) : null;
    this.stmts.get('createSession')!.run(sessionId, userId, now, now, metadataJson);
    logger.debug(`Created session: ${sessionId} for user: ${userId}`);
  }

  getSession(sessionId: string): SessionInfo | null {
    const row = this.stmts.get('getSession')!.get(sessionId) as any;
    if (!row) return null;

    return {
      id: row.id,
      userId: row.user_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    };
  }

  sessionExists(sessionId: string): boolean {
    return this.getSession(sessionId) !== null;
  }

  deleteSession(sessionId: string): void {
    this.stmts.get('deleteSession')!.run(sessionId);
    logger.debug(`Deleted session: ${sessionId}`);
  }

  // ========== Message Methods ==========

  addMessage(message: Message, sessionId: string): void {
    this.stmts.get('addMessage')!.run(
      message.id || this.generateId(),
      sessionId,
      message.role,
      message.content,
      message.toolCallId || null,
      message.toolName || null,
      message.timestamp || Math.floor(Date.now() / 1000),
      null // tokens can be calculated later
    );
    logger.debug(`Added message to session ${sessionId}`);
  }

  getMessages(sessionId: string, limit?: number): Message[] {
    const stmt = limit
      ? this.stmts.get('getRecentMessages')!
      : this.stmts.get('getMessages')!;

    const rows = limit
      ? stmt.all(sessionId, limit) as any[]
      : stmt.all(sessionId) as any[];
    return rows.map(row => ({
      id: row.id,
      sessionId: row.session_id,
      role: row.role,
      content: row.content,
      toolCallId: row.tool_call_id,
      toolName: row.tool_name,
      timestamp: row.timestamp
    }));
  }

  getMessagesByRole(sessionId: string, role: string): Message[] {
    const stmt = this.db.prepare(`
      SELECT id, session_id, role, content, tool_call_id, tool_name, timestamp, tokens
      FROM messages WHERE session_id = ? AND role = ? ORDER BY timestamp ASC
    `);
    const rows = stmt.all(sessionId, role) as any[];
    return rows.map(row => ({
      id: row.id,
      sessionId: row.session_id,
      role: row.role,
      content: row.content,
      toolCallId: row.tool_call_id,
      toolName: row.tool_name,
      timestamp: row.timestamp
    }));
  }

  clearMessages(sessionId: string): void {
    this.stmts.get('deleteMessages')!.run(sessionId);
    logger.debug(`Cleared messages for session: ${sessionId}`);
  }

  // ========== Memory Methods ==========

  addMemory(content: string, sessionId?: string, importance: number = 1.0, tags?: string[], userId?: string): string {
    const id = this.generateId();
    const now = Math.floor(Date.now() / 1000);
    const tagsJson = tags ? JSON.stringify(tags) : null;

    // 直接执行 SQL 而不是使用 prepared statement，因为参数数量可能不同
    this.db.prepare(`
      INSERT INTO memories (id, session_id, user_id, content, importance, access_count, created_at, accessed_at, tags)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)
    `).run(id, sessionId || null, userId || null, content, importance, now, now, tagsJson);

    logger.debug(`Added memory: ${id}`);
    return id;
  }

  getMemory(id: string): MemoryRecord | null {
    const row = this.stmts.get('getMemory')!.get(id) as any;
    if (!row) return null;

    return this.mapMemoryRow(row);
  }

  getMemories(sessionId?: string, limit: number = 100): MemoryRecord[] {
    let stmt;
    let params: any[] = [];

    if (sessionId) {
      stmt = this.db.prepare(`SELECT * FROM memories WHERE session_id = ? ORDER BY created_at DESC LIMIT ?`);
      params = [sessionId, limit];
    } else {
      stmt = this.db.prepare(`SELECT * FROM memories WHERE session_id IS NULL ORDER BY created_at DESC LIMIT ?`);
      params = [limit];
    }

    const rows = stmt.all(...params) as any[];

    return rows.map(row => {
      this.stmts.get('updateMemoryAccess')!.run(Math.floor(Date.now() / 1000), row.id);
      return this.mapMemoryRow(row);
    });
  }

  getMemoriesByUser(userId: string, limit: number = 100): MemoryRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM memories WHERE user_id = ? ORDER BY importance DESC, accessed_at DESC LIMIT ?
    `);
    const rows = stmt.all(userId, limit) as any[];

    return rows.map(row => {
      this.stmts.get('updateMemoryAccess')!.run(Math.floor(Date.now() / 1000), row.id);
      return this.mapMemoryRow(row);
    });
  }

  searchMemories(query: string, sessionId?: string, limit: number = 10): MemoryRecord[] {
    // 简单的 LIKE 搜索，生产环境可用 FTS5 或向量搜索
    const stmt = this.db.prepare(`
      SELECT * FROM memories
      WHERE (session_id = ? OR session_id IS NULL OR user_id = ?) AND content LIKE ?
      ORDER BY importance DESC, accessed_at DESC
      LIMIT ?
    `);

    const rows = stmt.all(sessionId || null, sessionId || null, `%${query}%`, limit) as any[];
    return rows.map(row => this.mapMemoryRow(row));
  }

  deleteMemory(id: string): void {
    this.stmts.get('deleteMemory')!.run(id);
    logger.debug(`Deleted memory: ${id}`);
  }

  private mapMemoryRow(row: any): MemoryRecord {
    return {
      id: row.id,
      sessionId: row.session_id || undefined,
      content: row.content,
      importance: row.importance,
      accessCount: row.access_count,
      tags: row.tags ? JSON.parse(row.tags) : undefined,
      createdAt: row.created_at,
      accessedAt: row.accessed_at
    };
  }

  // ========== Tool Call Methods ==========

  addToolCall(call: ToolCallRecord): void {
    this.stmts.get('addToolCall')!.run(
      call.id,
      call.sessionId,
      call.messageId || null,
      call.toolName,
      JSON.stringify(call.parameters),
      call.result ? JSON.stringify(call.result) : null,
      call.success ? 1 : 0,
      call.durationMs || null,
      call.timestamp
    );
    logger.debug(`Recorded tool call: ${call.toolName}`);
  }

  getToolCalls(sessionId: string, toolName?: string): ToolCallRecord[] {
    const stmt = toolName
      ? this.db.prepare(`SELECT * FROM tool_calls WHERE session_id = ? AND tool_name = ? ORDER BY timestamp DESC`)
      : this.stmts.get('getToolCalls')!;

    const rows = toolName
      ? stmt.all(sessionId, toolName) as any[]
      : stmt.all(sessionId) as any[];

    return rows.map(row => ({
      id: row.id,
      sessionId: row.session_id,
      messageId: row.message_id || undefined,
      toolName: row.tool_name,
      parameters: JSON.parse(row.parameters),
      result: row.result ? JSON.parse(row.result) : undefined,
      success: row.success === 1,
      durationMs: row.duration_ms,
      timestamp: row.timestamp
    }));
  }

  // ========== Utility Methods ==========

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  close(): void {
    this.db.close();
    logger.info('Memory store closed');
  }

  // 检查点：创建快照
  checkpoint(): void {
    this.db.pragma('wal_checkpoint(TRUNCATE)');
    logger.debug('Checkpoint created');
  }
}
