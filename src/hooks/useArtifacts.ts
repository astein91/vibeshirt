"use client";

import { useState, useEffect, useCallback } from "react";

export interface Artifact {
  id: string;
  type: string;
  storage_url: string;
  storage_key: string;
  metadata: Record<string, unknown>;
  prompt: string | null;
  source_artifact_id: string | null;
  created_at: string;
}

export function useArtifacts(sessionId: string | null) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchArtifacts = useCallback(async () => {
    if (!sessionId) {
      setArtifacts([]);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/sessions/${sessionId}/artifacts`);
      if (!response.ok) {
        throw new Error("Failed to fetch artifacts");
      }
      const data = await response.json();
      setArtifacts(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchArtifacts();
  }, [fetchArtifacts]);

  // Poll for new artifacts
  useEffect(() => {
    if (!sessionId) return;

    const interval = setInterval(() => {
      fetchArtifacts();
    }, 5000);

    return () => clearInterval(interval);
  }, [sessionId, fetchArtifacts]);

  const uploadArtifact = useCallback(
    async (file: File) => {
      if (!sessionId) throw new Error("No session");

      const formData = new FormData();
      formData.append("file", file);
      formData.append("sessionId", sessionId);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload artifact");
      }

      const artifact = await response.json();
      setArtifacts((prev) => [artifact, ...prev]);
      return artifact;
    },
    [sessionId]
  );

  const latestGenerated = artifacts.find((a) => a.type === "GENERATED");
  const latestNormalized = artifacts.find((a) => a.type === "NORMALIZED");
  const latestArtifact = latestNormalized || latestGenerated || artifacts[0];

  return {
    artifacts,
    isLoading,
    error,
    refetch: fetchArtifacts,
    uploadArtifact,
    latestArtifact,
    latestGenerated,
    latestNormalized,
  };
}
