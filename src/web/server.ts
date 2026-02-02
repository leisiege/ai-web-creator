/**
 * Web Server - Express Server Entry Point
 */
import express from 'express';
import cors from 'cors';
import { createRunner } from '../agents/runner.js';
import { chatRouter } from './routes/chat.js';
import { sessionsRouter } from './routes/sessions.js';
import { memoryRouter } from './routes/memory.js';
import type { HealthResponse } from './types.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const runner = createRunner();

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// API Routes
app.use('/api/chat', chatRouter(runner));
app.use('/api/sessions', sessionsRouter(runner));
app.use('/api/memory', memoryRouter(runner));

// Health check
app.get('/api/health', (_req, res) => {
  const stats = runner.getStats();
  const response: HealthResponse = {
    status: 'ok',
    uptime: process.uptime(),
    activeAgents: stats.activeAgents
  };
  res.json(response);
});

// Static files (serving frontend in production)
const distPath = path.join(__dirname, '../../web/dist');
app.use(express.static(distPath));

// SPA fallback - serve index.html for non-API routes
app.use((req, res) => {
  // Don't handle API routes
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: 'API endpoint not found' });
    return;
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`
╔═════════════════════════════════════════════════════════╗
║                                                           ║
║   AI Web Creator - Web Server                            ║
║                                                           ║
║   Server running on: http://localhost:${PORT}              ║
║   API endpoint:   http://localhost:${PORT}/api             ║
║                                                           ║
║   Press Ctrl+C to stop                                    ║
║                                                           ║
╚═════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    runner.shutdown();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\nSIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    runner.shutdown();
    process.exit(0);
  });
});

export { app, runner };
