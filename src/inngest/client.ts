import { Inngest } from "inngest";

// Create the Inngest client
export const inngest = new Inngest({
  id: "vibeshirt",
  eventKey: process.env.INNGEST_EVENT_KEY,
});

// Event types
export type Events = {
  "artwork/generate": {
    data: {
      jobId: string;
      sessionId: string;
      prompt: string;
      style?: string;
      sourceArtifactId?: string | null;
    };
  };
  "artwork/normalize": {
    data: {
      jobId: string;
      sessionId: string;
      artifactId: string;
      removeBackground: boolean;
      targetWidth: number;
      targetHeight: number;
      targetDpi: number;
    };
  };
  "printful/create-product": {
    data: {
      jobId: string;
      sessionId: string;
      artifactId: string;
      multiState: unknown;
      config: {
        productId: number;
        title: string;
        description: string;
        variantIds: number[];
        retailPrice: number; // cents
      };
    };
  };
  "chat/tailor.mentioned": {
    data: {
      sessionId: string;
      messageId: string;
      content: string;
      authorName: string;
    };
  };
};
