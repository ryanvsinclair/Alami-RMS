import type { Viewport } from "next";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { HomeDashboardClient } from "@/features/home/ui";
import { PublicLandingPage } from "@/features/marketing/ui/PublicLandingPage";

// Hero top section is the blue gradient — match the start color of --hero-bg.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#007fff" },
    { media: "(prefers-color-scheme: light)", color: "#007fff" },
  ],
};

async function hasValidSession(): Promise<boolean> {
  const store = await cookies();
  const accessToken = store.get("sb-access-token")?.value;
  const refreshToken = store.get("sb-refresh-token")?.value;
  if (!accessToken) return false;
  if (!refreshToken) return false;

  // Fast path: if JWT is expired (or malformed), treat as signed out.
  // This prevents loading the dashboard shell and immediately bouncing to
  // /auth/login from protected server actions.
  const tokenParts = accessToken.split(".");
  if (tokenParts.length !== 3) return false;

  try {
    const payloadRaw = tokenParts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payloadRaw.padEnd(Math.ceil(payloadRaw.length / 4) * 4, "=");
    const payloadJson = Buffer.from(padded, "base64").toString("utf8");
    const payload = JSON.parse(payloadJson) as { exp?: number };

    if (typeof payload.exp !== "number") return false;
    const nowInSeconds = Math.floor(Date.now() / 1000);
    if (payload.exp <= nowInSeconds + 15) return false;
  } catch {
    return false;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return false;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error) return false;
  return Boolean(data.user);
}

export default async function HomePage() {
  const isAuthenticated = await hasValidSession();
  if (!isAuthenticated) {
    return <PublicLandingPage />;
  }

  return <HomeDashboardClient />;
}
