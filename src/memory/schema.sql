-- Agent 记忆系统数据库 Schema
-- 参考 clawdbot 的设计，简化实现

-- 会话表：存储对话会话
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  metadata TEXT
);

-- 消息表：存储对话消息
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('system', 'user', 'assistant', 'tool')),
  content TEXT NOT NULL,
  tool_call_id TEXT,
  tool_name TEXT,
  timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  tokens INTEGER,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- 记忆表：存储长期记忆和知识
CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  user_id TEXT,
  content TEXT NOT NULL,
  embedding BLOB,
  importance REAL DEFAULT 1.0,
  access_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  accessed_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  tags TEXT
);

-- 工具调用记录表
CREATE TABLE IF NOT EXISTS tool_calls (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  message_id TEXT,
  tool_name TEXT NOT NULL,
  parameters TEXT NOT NULL,
  result TEXT,
  success INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(session_id, role);
CREATE INDEX IF NOT EXISTS idx_memories_session ON memories(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance DESC, accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_tool_calls_session ON tool_calls(session_id, timestamp);

-- 触发器：自动更新会话的 updated_at
CREATE TRIGGER IF NOT EXISTS update_session_timestamp
AFTER INSERT ON messages
BEGIN
  UPDATE sessions SET updated_at = strftime('%s', 'now') WHERE id = NEW.session_id;
END;
