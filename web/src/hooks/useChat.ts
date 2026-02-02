/**
 * useChat Hook
 */
import { useState, useCallback, useRef } from 'react';
import type { Message } from '../types.js';
import { sendChat, clearSession } from '../lib/api.js';

export function useChat(userId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track if messages exist to prevent duplicate loading
  const hasMessagesRef = useRef(false);

  const sendMessage = useCallback(async (content: string) => {
    // Add user message immediately
    const userMsg: Message = {
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    hasMessagesRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const data = await sendChat({
        userId,
        sessionId,
        message: content,
      });

      // Add assistant message
      const assistantMsg: Message = {
        role: 'assistant',
        content: data.response,
        timestamp: data.timestamp,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Save sessionId
      if (data.sessionId && data.sessionId !== sessionId) {
        setSessionId(data.sessionId);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
      // Remove the user message that failed
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }, [userId, sessionId]);

  const clearHistory = useCallback(async () => {
    if (sessionId) {
      try {
        await clearSession(sessionId);
      } catch (err) {
        console.error('Failed to clear session:', err);
      }
    }
    setMessages([]);
    setSessionId(undefined);
    hasMessagesRef.current = false;
    setError(null);
  }, [sessionId]);

  return {
    messages,
    sessionId,
    loading,
    error,
    sendMessage,
    clearHistory,
    hasMessages: hasMessagesRef.current,
  };
}
