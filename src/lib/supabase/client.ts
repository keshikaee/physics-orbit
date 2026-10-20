"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser client (public URL + publishable key only). Used for direct uploads
 * to a one-time signed URL that the server issued after checking the admin role.
 */
export function createBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase is not configured.");
  return createBrowserClient(url, key);
}
