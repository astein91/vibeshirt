import { useState, useCallback, useRef } from "react";

interface MockupResult {
  placement: string;
  variantIds: number[];
  imageUrl: string;
  extras?: { title: string; url: string }[];
}

interface UsePrintfulMockupReturn {
  generateMockup: (params: {
    productId: number;
    variantIds: number[];
    imageUrl: string;
    placement?: string;
  }) => Promise<MockupResult[] | null>;
  mockups: MockupResult[] | null;
  isGenerating: boolean;
  error: string | null;
}

export function usePrintfulMockup(): UsePrintfulMockupReturn {
  const [mockups, setMockups] = useState<MockupResult[] | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const pollForResult = useCallback(async (taskKey: string): Promise<MockupResult[] | null> => {
    const maxAttempts = 30; // 30 seconds max
    let attempts = 0;

    return new Promise((resolve, reject) => {
      pollIntervalRef.current = setInterval(async () => {
        attempts++;

        try {
          const response = await fetch(`/api/printful/mockups?taskKey=${taskKey}`);
          const data = await response.json();

          if (data.status === "completed") {
            clearInterval(pollIntervalRef.current!);
            resolve(data.mockups);
          } else if (data.status === "error" || data.error) {
            clearInterval(pollIntervalRef.current!);
            reject(new Error(data.error || "Mockup generation failed"));
          } else if (attempts >= maxAttempts) {
            clearInterval(pollIntervalRef.current!);
            reject(new Error("Mockup generation timed out"));
          }
          // Otherwise, continue polling (status === "pending")
        } catch (err) {
          clearInterval(pollIntervalRef.current!);
          reject(err);
        }
      }, 1000); // Poll every second
    });
  }, []);

  const generateMockup = useCallback(
    async (params: {
      productId: number;
      variantIds: number[];
      imageUrl: string;
      placement?: string;
    }): Promise<MockupResult[] | null> => {
      setIsGenerating(true);
      setError(null);

      try {
        // Create the mockup generation task
        const createResponse = await fetch("/api/printful/mockups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: params.productId,
            variantIds: params.variantIds,
            imageUrl: params.imageUrl,
            placement: params.placement || "front",
          }),
        });

        const createData = await createResponse.json();

        if (createData.error) {
          throw new Error(createData.error);
        }

        // Poll for the result
        const result = await pollForResult(createData.taskKey);
        setMockups(result);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to generate mockup";
        setError(message);
        return null;
      } finally {
        setIsGenerating(false);
      }
    },
    [pollForResult]
  );

  return {
    generateMockup,
    mockups,
    isGenerating,
    error,
  };
}
