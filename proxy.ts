import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// ── Constants ───────────────────────────────────────────────────────────────

const ACCESS_TOKEN_COOKIE = "sb-access-token";
const REFRESH_TOKEN_COOKIE = "sb-refresh-token";

const PUBLIC_PATHS = new Set([
  "/auth/login",
  "/auth/signup",
  "/auth/accept-invite",
  "/manifest.webmanifest",
  "/sw.js",
]);

// ── Helpers ─────────────────────────────────────────────────────────────────

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

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  };
}

function clearCookies(request: NextRequest, response: NextResponse) {
  request.cookies.delete(ACCESS_TOKEN_COOKIE);
  request.cookies.delete(REFRESH_TOKEN_COOKIE);
  response.cookies.delete(ACCESS_TOKEN_COOKIE);
  response.cookies.delete(REFRESH_TOKEN_COOKIE);
  return response;
}

function redirectToLogin(request: NextRequest) {
  return NextResponse.redirect(new URL("/auth/login", request.url));
}

// ── Proxy ───────────────────────────────────────────────────────────────────

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Bypass static assets, API routes, and public pages.
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".") ||
    PUBLIC_PATHS.has(pathname)
  ) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  // 2. No tokens at all -> redirect to login.
  if (!accessToken) {
    return redirectToLogin(request);
  }

  const response = NextResponse.next();

  // 3. Validate the access token.
  try {
    const supabase = createAnonClient();
    const { data, error } = await supabase.auth.getUser(accessToken);

    if (!error && data.user) {
      // Token is still valid.
      // If user is hitting an auth page while logged in, bounce to home.
      if (pathname.startsWith("/auth/")) {
        return NextResponse.redirect(new URL("/", request.url));
      }
      return response;
    }

    // 4. Access token expired -- try refreshing.
    if (!refreshToken) {
      return clearCookies(request, redirectToLogin(request));
    }

    const refreshed = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    const newAccess = refreshed.data.session?.access_token;
    const newRefresh = refreshed.data.session?.refresh_token;

    if (refreshed.error || !newAccess || !newRefresh) {
      return clearCookies(request, redirectToLogin(request));
    }

    const opts = cookieOptions();

    // Make the fresh tokens visible to the current server render pass.
    request.cookies.set(ACCESS_TOKEN_COOKIE, newAccess);
    request.cookies.set(REFRESH_TOKEN_COOKIE, newRefresh);

    // Persist the fresh tokens in the browser.
    response.cookies.set(ACCESS_TOKEN_COOKIE, newAccess, opts);
    response.cookies.set(REFRESH_TOKEN_COOKIE, newRefresh, opts);

    if (pathname.startsWith("/auth/")) {
      const redirect = NextResponse.redirect(new URL("/", request.url));
      redirect.cookies.set(ACCESS_TOKEN_COOKIE, newAccess, opts);
      redirect.cookies.set(REFRESH_TOKEN_COOKIE, newRefresh, opts);
      return redirect;
    }

    return response;
  } catch {
    // Network / unexpected error -- let the request through so server
    // components can attempt their own validation and show a proper error.
    return response;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
