import type { Profile } from "./invoiceflow.ts";

const blank = (s: string | null | undefined) => !s?.trim();

/** Mirrors invoice-api's finalize gate (address, country, phone, taxNumber or vatId). */
export function missingForFinalize(p: Profile): string[] {
  const missing = (["street", "postalCode", "city", "country", "phone"] as const).filter((f) => blank(p[f]));
  const fields: string[] = [...missing];
  if (blank(p.taxNumber) && blank(p.vatId)) fields.push("taxNumber or vatId");
  return fields;
}

export function recommended(p: Profile): string[] {
  return blank(p.iban) ? ["iban"] : [];
}
