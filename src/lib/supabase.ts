import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const supabaseEnvMissing =
  !import.meta.env.VITE_SUPABASE_URL ||
  !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

let client: SupabaseClient | null = null;

/** Shared browser client (publishable key only — never the secret key). */
export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!url || !key) {
    throw new Error(
      "Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY. Copy them into .env.local (local) or Vercel env vars (hosted)."
    );
  }
  client = createClient(url, key);
  return client;
}

/** Public URL for an object in the idol-cards bucket. */
export function cardPhotoUrl(photoPath: string): string {
  return getSupabase().storage.from("idol-cards").getPublicUrl(photoPath).data.publicUrl;
}
