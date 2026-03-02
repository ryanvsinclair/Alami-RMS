import { redirect } from "next/navigation";

/**
 * Canonical table-service entrypoint.
 * Redirects to table selection for host workflow bootstrap.
 */
export default function TableServiceIndexPage() {
  redirect("/service/tables");
}

