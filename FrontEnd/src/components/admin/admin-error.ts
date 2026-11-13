import { adminCopy } from "@/content/admin";
import { AdminError, BulkError } from "@/hooks/use-admin";

const { errors } = adminCopy;

/** Vietnamese message for a failed admin action. Backend details are stable English strings. */
export function adminErrorMessage(error: unknown): string {
  if (error instanceof BulkError) return errors.partial(error.failed);
  if (!(error instanceof AdminError)) return errors.generic;
  if (error.message === "You cannot change your own role or lock your own account.") return errors.self;
  if (error.status === 401 || error.status === 403) return errors.forbidden;
  if (error.status === 404) return errors.notFound;
  return errors.generic;
}
