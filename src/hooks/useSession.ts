"use client";

import { useState, useEffect, useCallback } from "react";

export interface Session {
  id: string;
  status: string;
  is_public: boolean;
  share_slug: string | null;
  vibe_description: string | null;
  artwork_prompt: string | null;
  printify_config: unknown;
  printify_product_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useSession(sessionId: string | null) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = useCallback(async () => {
    if (!sessionId) {
      setSession(null);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/sessions/${sessionId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch session");
      }
      const data = await response.json();
      setSession(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const updateSession = useCallback(
    async (updates: Partial<Session>) => {
      if (!sessionId) return;

      try {
        const response = await fetch(`/api/sessions/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          throw new Error("Failed to update session");
        }

        const data = await response.json();
        setSession(data);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        throw err;
      }
    },
    [sessionId]
  );

  const makePublic = useCallback(async () => {
    if (!sessionId) return;

    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: true }),
      });

      if (!response.ok) {
        throw new Error("Failed to make session public");
      }

      const data = await response.json();
      setSession(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      throw err;
    }
  }, [sessionId]);

  return {
    session,
    isLoading,
    error,
    refetch: fetchSession,
    updateSession,
    makePublic,
  };
}

export function useCreateSession() {
  const [isCreating, setIsCreating] = useState(false);

  const createSession = async (vibeDescription?: string) => {
    setIsCreating(true);
    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vibeDescription }),
      });

      if (!response.ok) {
        throw new Error("Failed to create session");
      }

      return await response.json();
    } finally {
      setIsCreating(false);
    }
  };

  return { createSession, isCreating };
}
