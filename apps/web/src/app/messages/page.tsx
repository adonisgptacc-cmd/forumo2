import { redirect } from "next/navigation";

/**
 * Redirect the bare /messages route to the authenticated app inbox.
 * The (authenticated) layout enforces login; unauthenticated visitors are
 * sent to /login automatically.
 */
export default function MessagesRedirect() {
  redirect("/app/messages");
}
