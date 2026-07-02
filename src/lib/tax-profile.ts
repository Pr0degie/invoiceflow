import type { components } from "@/lib/api/schema";

type UserDto = components["schemas"]["UserDto"];

// Mirrors the backend's finalization gate (§ 14 Abs. 4 UStG): complete postal
// address plus at least one of Steuernummer / USt-IdNr.
export function isTaxProfileComplete(me: UserDto | null | undefined): boolean {
  if (!me) return false;
  const hasTaxId = !!(me.taxNumber || me.vatId);
  return (
    hasTaxId && !!me.street && !!me.postalCode && !!me.city && !!me.country
  );
}
