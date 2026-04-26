import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Mail } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/language-switcher";

const socials = [
  {
    label: "GitHub",
    href: "https://github.com/Pr0degie",
    icon: (
      <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor">
        <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
      </svg>
    ),
  },
  {
    label: "LinkedIn",
    href: "https://linkedin.com",
    icon: (
      <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
  {
    label: "Email",
    href: "mailto:tobiastransformers@hotmail.de",
    icon: <Mail className="size-3.5" />,
  },
];

export async function Footer() {
  const t = await getTranslations("landing.footer");
  const tNav = await getTranslations("common.nav");

  const nav = [
    {
      label: t("nav.product"),
      links: [
        { name: tNav("features"), href: "#features" },
        { name: t("nav.links.pricing"), href: "#pricing" },
        { name: t("nav.links.changelog"), href: "#" },
        { name: t("nav.links.roadmap"), href: "#" },
      ],
    },
    {
      label: t("nav.resources"),
      links: [
        { name: t("nav.links.docs"), href: "#" },
        { name: t("nav.links.api"), href: "#" },
        {
          name: t("nav.links.frontendGitHub"),
          href: "https://github.com/Pr0degie/invoiceflow",
        },
        {
          name: t("nav.links.backendGitHub"),
          href: "https://github.com/Pr0degie/invoice-api",
        },
      ],
    },
    {
      label: t("nav.legal"),
      links: [
        { name: t("nav.links.imprint"), href: "#" },
        { name: t("nav.links.privacy"), href: "#" },
        { name: t("nav.links.terms"), href: "#" },
      ],
    },
  ];

  const year = new Date().getFullYear();

  return (
    <footer className="border-t bg-background">
      {/* Upper zone */}
      <div className="container mx-auto max-w-6xl px-4 py-12 md:py-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-[2fr_1fr_1fr_1fr]">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="inline-flex mb-3">
              <Logo />
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              {t("brand.tagline")}
            </p>
            {/* Socials */}
            <div className="flex gap-3 mt-5">
              {socials.map(({ icon, label, href }) => (
                <Link
                  key={label}
                  href={href}
                  aria-label={label}
                  className="size-8 rounded-md border border-border/60 flex items-center justify-center text-muted-foreground transition-colors hover:text-foreground hover:border-border"
                  {...(href.startsWith("http")
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                >
                  {icon}
                </Link>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {nav.map(({ label, links }) => (
            <div key={label}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                {label}
              </p>
              <ul className="space-y-3">
                {links.map(({ name, href }) => (
                  <li key={name}>
                    <Link
                      href={href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      {...(href.startsWith("http")
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                    >
                      {name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Lower zone */}
      <div className="border-t">
        <div className="container mx-auto max-w-6xl px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {t("copyright", { year })}
          </p>
          <div className="flex items-center gap-4">
            <p className="text-xs text-muted-foreground">
              {t("builtWith")}{" "}
              <span className="text-foreground/60">Next.js · Prisma · Stripe</span>
            </p>
            <LanguageSwitcher />
          </div>
        </div>
      </div>
    </footer>
  );
}
