"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface Message {
  id: string;
  role: string;
  author_name: string | null;
  content: string;
  artifact_id: string | null;
  created_at: string;
}

interface UseMessagesOptions {
  pollInterval?: number;
}

export function useMessages(
  sessionId: string | null,
  options: UseMessagesOptions = {}
) {
  const { pollInterval = 2000 } = options;

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const cursorRef = useRef<string | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchMessages = useCallback(
    async (after?: string) => {
      if (!sessionId) return;

      try {
        const url = after
          ? `/api/sessions/${sessionId}/messages?after=${encodeURIComponent(after)}`
          : `/api/sessions/${sessionId}/messages`;

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error("Failed to fetch messages");
        }

        const data = await response.json();

        if (after) {
          if (data.messages.length > 0) {
            setMessages((prev) => {
              const existingIds = new Set(prev.map((m) => m.id));
              const newMessages = data.messages.filter(
                (m: Message) => !existingIds.has(m.id)
              );
              return newMessages.length > 0 ? [...prev, ...newMessages] : prev;
            });
          }
        } else {
          setMessages(data.messages);
        }

        cursorRef.current = data.cursor;
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId]
  );

  useEffect(() => {
    setIsLoading(true);
    setMessages([]);
    cursorRef.current = null;
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    if (!sessionId || pollInterval <= 0) return;

    let cancelled = false;

    const poll = () => {
      pollTimeoutRef.current = setTimeout(async () => {
        if (cancelled) return;
        await fetchMessages(cursorRef.current || undefined);
        if (!cancelled) poll();
      }, pollInterval);
    };

    poll();

    return () => {
      cancelled = true;
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, [sessionId, pollInterval, fetchMessages]);

  const sendMessage = useCallback(
    async (content: string, authorName: string) => {
      if (!sessionId) return;

      setIsSending(true);
      try {
        const response = await fetch(`/api/sessions/${sessionId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content,
            authorName,
            role: "user",
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to send message");
        }

        const data = await response.json();

        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
        cursorRef.current = data.message.created_at;

        return data;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        throw err;
      } finally {
        setIsSending(false);
      }
    },
    [sessionId]
  );

  return {
    messages,
    isLoading,
    isSending,
    error,
    sendMessage,
    refetch: () => fetchMessages(),
  };
}
