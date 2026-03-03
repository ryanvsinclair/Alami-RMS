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
    <header className="hidden md:block sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="flex items-center justify-between h-16 px-4 max-w-lg mx-auto">
        <div className="flex items-center gap-2">
          {backHref && (
            <button
              onClick={() => router.push(backHref)}
              className="inline-flex items-center text-[17px] font-normal text-primary"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>
          )}
          <h1 className="text-[28px] font-semibold tracking-tight text-foreground">{title}</h1>
        </div>
        {action && <div>{action}</div>}
      </div>
    </header>
  );
}
