"use server";

import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { clearAuthCookies, setAuthCookies } from "@/lib/auth/server";
import { ensureRestaurantForUser } from "@/lib/auth/tenant";

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

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");

  if (!email || !password) {
    redirect("/auth/login?error=Email%20and%20password%20are%20required");
  }

  const supabase = createAnonClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session?.access_token || !data.user) {
    redirect(`/auth/login?error=${encodeURIComponent(error?.message ?? "Invalid credentials")}`);
  }

  await setAuthCookies(data.session.access_token, data.session.refresh_token);
  redirect(next.startsWith("/") ? next : "/");
}

export async function signUpAction(formData: FormData) {
  const restaurantName = String(formData.get("restaurant_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");

  if (!restaurantName || !email || !password) {
    redirect("/auth/signup?error=Restaurant%2C%20email%2C%20and%20password%20are%20required");
  }

  const supabase = createAnonClient();
  const signUpResult = await supabase.auth.signUp({
    email,
    password,
  });

  if (signUpResult.error || !signUpResult.data.user) {
    redirect(`/auth/signup?error=${encodeURIComponent(signUpResult.error?.message ?? "Signup failed")}`);
  }

  const signInResult = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInResult.error || !signInResult.data.session?.access_token || !signInResult.data.user) {
    redirect("/auth/login?error=Account%20created.%20Please%20sign%20in.");
  }

  await setAuthCookies(
    signInResult.data.session.access_token,
    signInResult.data.session.refresh_token
  );
  await ensureRestaurantForUser(signInResult.data.user.id, restaurantName);
  redirect(next.startsWith("/") ? next : "/");
}

export async function signOutAction() {
  await clearAuthCookies();
  redirect("/auth/login");
}
