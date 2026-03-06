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
      formatted_address: true,
      google_place_id: true,
    },
  });

  if (!business) {
    notFound();
  }

  const [categories, uncategorizedItems] = await Promise.all([
    prisma.menuCategory.findMany({
      where: { business_id: business.id },
      orderBy: [{ sort_order: "asc" }, { name: "asc" }],
      include: {
        items: {
          where: {
            business_id: business.id,
            is_available: true,
          },
          orderBy: [{ sort_order: "asc" }, { name: "asc" }],
        },
      },
    }),
    prisma.menuItem.findMany({
      where: {
        business_id: business.id,
        category_id: null,
        is_available: true,
      },
      orderBy: [{ sort_order: "asc" }, { name: "asc" }],
    }),
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl p-4 pt-8 md:px-6 xl:px-8">
      <Card className="p-5 space-y-3">
        <p className="text-xs normal-case tracking-normal text-muted">Public Landing</p>
        <h1 className="text-xl font-bold text-foreground">{business.name}</h1>
        {business.formatted_address && (
          <p className="text-sm text-muted">{business.formatted_address}</p>
        )}
        {business.google_place_id && (
          <a
            href={`https://search.google.com/local/writereview?placeid=${encodeURIComponent(
              business.google_place_id,
            )}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-fit items-center rounded-xl border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-foreground/5"
          >
            Leave a Review
          </a>
        )}
      </Card>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {categories.map((category) => (
          <Card key={category.id} className="p-5 space-y-3">
            <h2 className="text-sm font-semibold normal-case tracking-normal text-muted">{category.name}</h2>
            {category.items.length === 0 ? (
              <p className="text-sm text-muted">No items available in this category.</p>
            ) : (
              <div className="space-y-2">
                {category.items.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="h-12 w-12 rounded-lg border border-border object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-border text-[10px] text-muted">
                          IMG
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold">{item.name}</p>
                        {item.description && <p className="text-xs text-muted">{item.description}</p>}
                      </div>
                    </div>
                    <p className="text-sm font-semibold">${Number(item.price).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}

        {uncategorizedItems.length > 0 && (
          <Card className="p-5 space-y-3 md:col-span-2 xl:col-span-3">
            <h2 className="text-sm font-semibold normal-case tracking-normal text-muted">More</h2>
            <div className="space-y-2">
              {uncategorizedItems.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="h-12 w-12 rounded-lg border border-border object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-border text-[10px] text-muted">
                        IMG
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold">{item.name}</p>
                      {item.description && <p className="text-xs text-muted">{item.description}</p>}
                    </div>
                  </div>
                  <p className="text-sm font-semibold">${Number(item.price).toFixed(2)}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {categories.length === 0 && uncategorizedItems.length === 0 && (
          <Card className="p-5 md:col-span-2 xl:col-span-3">
            <p className="text-sm text-muted">Menu is not available yet.</p>
          </Card>
        )}
      </div>
    </main>
  );
}
