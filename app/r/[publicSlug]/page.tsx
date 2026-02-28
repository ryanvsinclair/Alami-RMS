import { notFound } from "next/navigation";
import { Card } from "@/shared/ui/card";
import { prisma } from "@/core/prisma";

export default async function PublicRestaurantLandingPage({
  params,
}: {
  params: Promise<{ publicSlug: string }>;
}) {
  const { publicSlug } = await params;
  const business = await prisma.business.findFirst({
    where: { id: publicSlug },
    select: {
      id: true,
      name: true,
    },
  });

  if (!business) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-lg p-4 pt-8">
      <Card className="p-5 space-y-3">
        <p className="text-xs uppercase tracking-wide text-muted">Public Landing</p>
        <h1 className="text-xl font-bold text-foreground">{business.name}</h1>
        <p className="text-sm text-muted">
          Public diner landing is active. Menu-first rendering is completed in RTS-02-c.
        </p>
      </Card>
    </main>
  );
}
