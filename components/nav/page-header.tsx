"use client";

import { useRouter } from "next/navigation";

export function PageHeader({
  title,
  backHref,
  action,
}: {
  title: string;
  backHref?: string;
  action?: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <header className="hidden md:block sticky top-0 z-40 border-b border-[rgba(128,164,202,0.22)] bg-[rgba(7,14,24,0.78)] backdrop-blur-xl">
      <div className="flex items-center justify-between h-16 px-4 max-w-lg mx-auto">
        <div className="flex items-center gap-2">
          {backHref && (
            <button
              onClick={() => router.push(backHref)}
              className="grid h-10 w-10 place-items-center rounded-full text-muted transition-colors hover:bg-white/10 hover:text-foreground"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>
          )}
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        </div>
        {action && <div>{action}</div>}
      </div>
    </header>
  );
}
