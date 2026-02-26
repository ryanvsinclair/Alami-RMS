"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/shared/ui/card";
import { useTerm } from "@/shared/config/business-context";

const ingestionMethods = [
  {
    href: "/receive/barcode",
    title: "Scan Barcode",
    description: "Fastest - scan & enter quantity",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 14.625v5.25h5.25v-5.25h-5.25Z" />
      </svg>
    ),
    color: "text-blue-300 bg-blue-400/14 ring-1 ring-inset ring-blue-300/26",
  },
  {
    href: "/receive/receipt",
    title: "Scan Receipt",
    description: "Bulk - parse entire receipt at once",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15a2.25 2.25 0 0 1 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
      </svg>
    ),
    color: "text-success bg-success/14 ring-1 ring-inset ring-success/26",
  },
  {
    href: "/receive/photo",
    title: "Photo Scan",
    description: "Medium - snap a product photo",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
      </svg>
    ),
    color: "text-violet-300 bg-violet-400/14 ring-1 ring-inset ring-violet-300/26",
  },
  {
    href: "/receive/manual",
    title: "Manual Entry",
    description: "Fallback - search & enter manually",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
      </svg>
    ),
    color: "text-amber-300 bg-amber-400/14 ring-1 ring-inset ring-amber-300/26",
  },
];

export default function ReceivePageClient() {
  const router = useRouter();
  const receiveTerm = useTerm("receive");
  const itemTerm = useTerm("item");
  const itemLabel = `${itemTerm.toLowerCase()}${itemTerm.toLowerCase().endsWith("s") ? "" : "s"}`;

  return (
    <div className="p-4 space-y-3">
      <p className="text-sm text-muted">Choose an input method to add {itemLabel}.</p>
      {ingestionMethods.map((method) => (
        <Card
          key={method.href}
          onClick={() => router.push(method.href)}
        >
          <div className="flex items-center gap-4">
            <div className={`rounded-xl p-3 ${method.color}`}>
              {method.icon}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">{method.title}</h3>
              <p className="text-sm text-muted/90">{method.description}</p>
            </div>
            <svg className="w-5 h-5 text-muted/90" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </div>
        </Card>
      ))}
    </div>
  );
}
