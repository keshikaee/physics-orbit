import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { homeForRole, isAdminRole } from "./routes";
import type { UserProfile } from "@/types";

/**
 * Data Access Layer — the single place that decides who the user is.
 * Every protected page/action must go through requireStudent / requireAdmin.
 */

/** Current user's profile, or null when signed out. Memoised per request. */
export const getCurrentProfile = cache(async (): Promise<UserProfile | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, status, avatar_url, created_at, curriculum_id, curriculum:curricula(id, slug, name, description)")
    .eq("id", auth.user.id)
    .single();

  if (error || !profile) return null;
  return profile as unknown as UserProfile;
});

async function requireActiveProfile(): Promise<UserProfile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.status !== "active") redirect("/login?error=suspended");
  return profile;
}

/** A student with a curriculum (students without one are sent to complete their profile first). */
export async function requireStudent(): Promise<UserProfile & { curriculum: NonNullable<UserProfile["curriculum"]> }> {
  const profile = await requireStudentAccount();
  if (!profile.curriculum) redirect("/complete-profile");
  return profile as UserProfile & { curriculum: NonNullable<UserProfile["curriculum"]> };
}

/** Any student account, curriculum or not (used by the profile-completion page). */
export async function requireStudentAccount(): Promise<UserProfile> {
  const profile = await requireActiveProfile();
  if (profile.role !== "student") redirect(homeForRole(profile.role));
  return profile;
}

export async function requireAdmin(): Promise<UserProfile> {
  const profile = await requireActiveProfile();
  if (!isAdminRole(profile.role)) redirect("/dashboard");
  return profile;
}
