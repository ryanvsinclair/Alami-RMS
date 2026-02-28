import { DocumentDraftDetailClient } from "@/features/documents/ui";

export default function DocumentDraftPage({
  params,
}: {
  params: { draftId: string };
}) {
  return <DocumentDraftDetailClient draftId={params.draftId} />;
}
