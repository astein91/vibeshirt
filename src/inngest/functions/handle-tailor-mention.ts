import { inngest } from "../client";
import { createServiceClient } from "@/lib/supabase/server";
import { parseUserIntent, generateResponse, generateImage } from "@/lib/gemini/generate";
import { uploadToStorage, getPublicUrl } from "@/lib/storage/client";
import { nanoid } from "nanoid";

export const handleTailorMention = inngest.createFunction(
  { id: "handle-tailor-mention" },
  { event: "chat/tailor.mentioned" },
  async ({ event, step }) => {
    const { sessionId, messageId, content, authorName } = event.data;

    const cleanedContent = content.replace(/@tailor/gi, "").trim();

    // Get session context
    const session = await step.run("get-session", async () => {
      const supabase = createServiceClient();
      const { data } = await supabase
        .from("design_sessions")
        .select("*, messages(*), artifacts(*)")
        .eq("id", sessionId)
        .single();

      if (data) {
        data.messages = (data.messages as Array<{ created_at: string }>)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .slice(0, 10);
        data.artifacts = (data.artifacts as Array<{ created_at: string }>)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .slice(0, 5);
      }

      return data;
    });

    if (!session) {
      return { success: false, error: "Session not found" };
    }

    const intent = await step.run("parse-intent", async () => {
      return parseUserIntent(cleanedContent);
    });

    const contextSummary = `
Session vibe: ${session.vibe_description || "Not set yet"}
Current artwork prompt: ${session.artwork_prompt || "None"}
Recent artifacts: ${session.artifacts.length} images
Status: ${session.status}
`.trim();

    switch (intent.type) {
      case "generate": {
        const response = await step.run("respond-to-generate", async () => {
          const supabase = createServiceClient();
          const reply = await generateResponse(
            contextSummary,
            `${authorName} wants to generate: ${intent.prompt}`
          );

          await supabase.from("messages").insert({
            session_id: sessionId,
            role: "assistant",
            author_name: "Tailor",
            content: reply,
          });

          return reply;
        });

        await step.run("trigger-generation", async () => {
          const supabase = createServiceClient();
          const { data: job } = await supabase
            .from("jobs")
            .insert({
              session_id: sessionId,
              type: "GENERATE_ARTWORK",
              status: "PENDING",
              input: { prompt: intent.prompt },
            })
            .select()
            .single();

          await supabase
            .from("design_sessions")
            .update({
              artwork_prompt: intent.prompt,
              status: "DESIGNING",
            })
            .eq("id", sessionId);

          await inngest.send({
            name: "artwork/generate",
            data: {
              jobId: job!.id,
              sessionId,
              prompt: intent.prompt!,
            },
          });
        });

        return { success: true, action: "generate", response };
      }

      case "modify": {
        const latestArtifact = (session.artifacts as Array<{ type: string; id: string }>).find(
          (a) => a.type === "GENERATED" || a.type === "NORMALIZED"
        );

        const response = await step.run("respond-to-modify", async () => {
          const supabase = createServiceClient();
          const reply = await generateResponse(
            contextSummary,
            `${authorName} wants to modify the design: ${intent.modifications?.join(", ")}`
          );

          await supabase.from("messages").insert({
            session_id: sessionId,
            role: "assistant",
            author_name: "Tailor",
            content: reply,
          });

          return reply;
        });

        if (latestArtifact) {
          await step.run("trigger-modification", async () => {
            const supabase = createServiceClient();
            const modificationPrompt = intent.modifications?.join(". ") || cleanedContent;

            const { data: job } = await supabase
              .from("jobs")
              .insert({
                session_id: sessionId,
                type: "GENERATE_ARTWORK",
                status: "PENDING",
                input: {
                  prompt: modificationPrompt,
                  sourceArtifactId: latestArtifact.id,
                },
              })
              .select()
              .single();

            await inngest.send({
              name: "artwork/generate",
              data: {
                jobId: job!.id,
                sessionId,
                prompt: modificationPrompt,
                sourceArtifactId: latestArtifact.id,
              },
            });
          });
        } else {
          await step.run("trigger-new-generation", async () => {
            const supabase = createServiceClient();
            const { data: job } = await supabase
              .from("jobs")
              .insert({
                session_id: sessionId,
                type: "GENERATE_ARTWORK",
                status: "PENDING",
                input: { prompt: cleanedContent },
              })
              .select()
              .single();

            await inngest.send({
              name: "artwork/generate",
              data: {
                jobId: job!.id,
                sessionId,
                prompt: cleanedContent,
              },
            });
          });
        }

        return { success: true, action: "modify", response };
      }

      case "question": {
        const response = await step.run("answer-question", async () => {
          const supabase = createServiceClient();
          const reply = await generateResponse(contextSummary, intent.question!);

          await supabase.from("messages").insert({
            session_id: sessionId,
            role: "assistant",
            author_name: "Tailor",
            content: reply,
          });

          return reply;
        });

        return { success: true, action: "answer", response };
      }

      default: {
        const response = await step.run("general-response", async () => {
          const supabase = createServiceClient();
          const reply = await generateResponse(contextSummary, cleanedContent);

          await supabase.from("messages").insert({
            session_id: sessionId,
            role: "assistant",
            author_name: "Tailor",
            content: reply,
          });

          return reply;
        });

        return { success: true, action: "chat", response };
      }
    }
  }
);
