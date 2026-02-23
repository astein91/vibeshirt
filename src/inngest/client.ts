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
  "printify/create-product": {
    data: {
      jobId: string;
      sessionId: string;
      artifactId: string;
      config: {
        blueprintId: number;
        printProviderId: number;
        variants: Array<{
          id: number;
          price: number;
          isEnabled: boolean;
        }>;
        title: string;
        description: string;
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
