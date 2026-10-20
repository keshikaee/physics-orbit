import { LogOut } from "lucide-react";
import { signOutAction } from "@/lib/auth/actions";
import type { UserProfile } from "@/types";

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join("") || "?"
  );
}

const roleLabel = { student: "Student", teacher: "Teacher", admin: "Admin" } as const;

/** Signed-in user's avatar, name, role and sign-out. Sits at the bottom of the app nav, inside <Suspense>. */
export function ProfileCard({ profile }: { profile: UserProfile }) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-2 py-2">
      <div
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orbit-primary text-sm font-semibold text-white"
      >
        {initials(profile.full_name)}
      </div>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-medium text-orbit-text">{profile.full_name}</p>
        <p className="text-xs text-orbit-text-muted">{roleLabel[profile.role]}</p>
      </div>
      <form action={signOutAction}>
        <button
          type="submit"
          aria-label="Sign out"
          title="Sign out"
          className="rounded-lg p-2 text-orbit-text-muted hover:bg-orbit-error-muted hover:text-orbit-error transition-colors"
        >
          <LogOut size={17} />
        </button>
      </form>
    </div>
  );
}

export function ProfileCardSkeleton() {
  return (
    <div className="flex items-center gap-3 px-2 py-2" aria-hidden="true">
      <div className="h-10 w-10 rounded-full bg-orbit-panel animate-pulse" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-24 rounded bg-orbit-panel animate-pulse" />
        <div className="h-2.5 w-14 rounded bg-orbit-panel animate-pulse" />
      </div>
    </div>
  );
}
