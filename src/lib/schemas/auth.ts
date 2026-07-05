import { z } from "zod";

// UI-language hint forwarded to the backend so verification/reset mails + links
// follow the user's locale. In practice this is always the active next-intl
// locale (de/en); we keep the field a permissive passthrough because the backend
// is the authority — it allowlists (de/en, else de), so an unexpected value is
// normalized there rather than rejected here.
const localeField = z.string().optional();

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  locale: localeField,
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
  locale: localeField,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Missing token"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, "Missing token"),
});

export const resendVerificationSchema = z.object({
  email: z.string().email("Invalid email address"),
  locale: localeField,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
