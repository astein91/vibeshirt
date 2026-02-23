import { createServiceClient } from "@/lib/supabase/server";

const BUCKET = "images";

export async function uploadToStorage(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  const supabase = createServiceClient();

  const { error } = await supabase.storage.from(BUCKET).upload(key, body, {
    contentType,
    upsert: true,
  });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  console.log(`[Storage] Uploaded to Supabase: ${key}`);
}

export async function getFromStorage(key: string): Promise<Buffer> {
  const supabase = createServiceClient();

  const { data, error } = await supabase.storage.from(BUCKET).download(key);
  if (error) throw new Error(`Storage download failed: ${error.message}`);

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export function getPublicUrl(key: string): string {
  const supabase = createServiceClient();

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(key);
  return data.publicUrl;
}
