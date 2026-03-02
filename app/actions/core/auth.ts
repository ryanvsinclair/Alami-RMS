"use server";

import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { clearAuthCookies, setAuthCookies } from "@/core/auth/server";
import { ensureBusinessForUser, resolvePostSignInPathForUser } from "@/core/auth/tenant";
import { isIndustryType } from "@/lib/config/presets";

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
  const postSignInPath = await resolvePostSignInPathForUser(data.user.id, next);
  redirect(postSignInPath);
}

export async function signUpAction(formData: FormData) {
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const dateOfBirthInput = String(formData.get("date_of_birth") ?? "").trim();
  const businessName = String(formData.get("business_name") ?? "").trim();
  const industryTypeInput = String(formData.get("industry_type") ?? "general").trim();
  const googlePlaceId = String(formData.get("google_place_id") ?? "").trim();
  const formattedAddress = String(formData.get("formatted_address") ?? "").trim();
  const latitudeInput = String(formData.get("place_latitude") ?? "").trim();
  const longitudeInput = String(formData.get("place_longitude") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");
  const next = String(formData.get("next") ?? "/");
  const industryType = isIndustryType(industryTypeInput) ? industryTypeInput : "general";
  const dateOfBirth = dateOfBirthInput ? new Date(`${dateOfBirthInput}T00:00:00.000Z`) : null;
  const isValidDateOfBirth =
    dateOfBirth != null &&
    !Number.isNaN(dateOfBirth.getTime()) &&
    dateOfBirth <= new Date();
  const parsedLatitude = latitudeInput ? Number.parseFloat(latitudeInput) : null;
  const parsedLongitude = longitudeInput ? Number.parseFloat(longitudeInput) : null;
  const latitude = parsedLatitude != null && Number.isFinite(parsedLatitude) ? parsedLatitude : null;
  const longitude = parsedLongitude != null && Number.isFinite(parsedLongitude) ? parsedLongitude : null;

  if (
    !firstName ||
    !lastName ||
    !dateOfBirthInput ||
    !businessName ||
    !email ||
    !phone ||
    !password ||
    !confirmPassword
  ) {
    redirect("/auth/signup?error=Please%20complete%20all%20required%20fields");
  }

  if (!isValidDateOfBirth) {
    redirect("/auth/signup?error=Please%20enter%20a%20valid%20date%20of%20birth");
  }

  if (industryType !== "restaurant") {
    redirect("/auth/signup?error=Only%20Restaurant%20is%20currently%20available");
  }

  if (password.length < 8) {
    redirect("/auth/signup?error=Password%20must%20be%20at%20least%208%20characters");
  }

  if (password !== confirmPassword) {
    redirect("/auth/signup?error=Password%20and%20confirm%20password%20must%20match");
  }

  const supabase = createAnonClient();
  const signUpResult = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
        date_of_birth: dateOfBirthInput,
        phone,
        full_name: `${firstName} ${lastName}`.trim(),
      },
    },
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
  await ensureBusinessForUser(signInResult.data.user.id, businessName, {
    industryType,
    googlePlaceId: industryType === "restaurant" && googlePlaceId ? googlePlaceId : null,
    formattedAddress: industryType === "restaurant" && formattedAddress ? formattedAddress : null,
    latitude: industryType === "restaurant" ? latitude : null,
    longitude: industryType === "restaurant" ? longitude : null,
  });
  redirect(next.startsWith("/") ? next : "/");
}

export async function signOutAction() {
  await clearAuthCookies();
  redirect("/auth/login");
}
