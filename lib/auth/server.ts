import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const ACCESS_TOKEN_COOKIE = "sb-access-token";
const REFRESH_TOKEN_COOKIE = "sb-refresh-token";

function createAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

export async function setAuthCookies(accessToken: string, refreshToken: string) {
  const store = await cookies();
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };

  store.set(ACCESS_TOKEN_COOKIE, accessToken, cookieOptions);
  store.set(REFRESH_TOKEN_COOKIE, refreshToken, cookieOptions);
}

export async function clearAuthCookies() {
  const store = await cookies();
  store.delete(ACCESS_TOKEN_COOKIE);
  store.delete(REFRESH_TOKEN_COOKIE);
}

export async function requireSupabaseUser() {
  const store = await cookies();
  const accessToken = store.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = store.get(REFRESH_TOKEN_COOKIE)?.value;

  if (!accessToken) {
    throw new Error("Unauthorized");
  }

  const supabase = createAnonClient();
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (!error && data.user) {
    return data.user;
  }

  if (!refreshToken) {
    throw new Error("Unauthorized");
  }

  const refreshed = await supabase.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (refreshed.error || !refreshed.data.session?.access_token || !refreshed.data.user) {
    throw new Error("Unauthorized");
  }

  await setAuthCookies(
    refreshed.data.session.access_token,
    refreshed.data.session.refresh_token
  );

  return refreshed.data.user;
}
