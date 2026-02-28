import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/core/prisma";
import {
  getOrCreateActiveTableSession,
  resolveDiningTableByQrToken,
} from "@/features/table-service/server";

async function getOptionalUserId() {
  const store = await cookies();
  const accessToken = store.get("sb-access-token")?.value;
  if (!accessToken) return null;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) return null;
  return data.user.id;
}

export default async function TableScanResolverPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const resolved = await resolveDiningTableByQrToken(token);

  if (!resolved) {
    notFound();
  }

  const userId = await getOptionalUserId();
  if (userId) {
    const membership = await prisma.userBusiness.findFirst({
      where: {
        user_id: userId,
        business_id: resolved.business.id,
      },
      select: { business_id: true },
    });

    if (membership) {
      const session = await getOrCreateActiveTableSession(membership.business_id, resolved.id);
      redirect(
        `/service/host?table=${encodeURIComponent(resolved.id)}&session=${encodeURIComponent(
          session.id,
        )}`,
      );
    }
  }

  redirect(`/r/${encodeURIComponent(resolved.business.id)}`);
}
