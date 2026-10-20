import { OrbitLogo } from "@/components/layout/orbit-logo";

export default function OnboardingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(ellipse_at_50%_0%,#e8f5ec_0%,#f9fbfa_55%)]">
      <header className="px-5 py-5 sm:px-8">
        <OrbitLogo size="sm" />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md animate-rise">{children}</div>
      </main>
    </div>
  );
}
