import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware wrappers around Next.js navigation APIs.
// Use these instead of next/link and next/navigation in client components,
// so a user on /de/* stays on German pages after navigation.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
