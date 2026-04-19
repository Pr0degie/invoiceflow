import Link from "next/link";

const nav = [
  {
    label: "Product",
    links: [
      { name: "Features", href: "#features" },
      { name: "Pricing", href: "#pricing" },
      { name: "Changelog", href: "#" },
      { name: "Roadmap", href: "#" },
    ],
  },
  {
    label: "Resources",
    links: [
      { name: "Docs", href: "#" },
      { name: "Blog", href: "#" },
      { name: "GitHub", href: "https://github.com" },
      { name: "Guides", href: "#" },
    ],
  },
  {
    label: "Company",
    links: [
      { name: "About", href: "#" },
      { name: "Contact", href: "mailto:hello@example.com" },
      { name: "Privacy", href: "#" },
      { name: "Terms", href: "#" },
    ],
  },
];

const socials = [
  {
    label: "GitHub",
    href: "https://github.com",
    svg: (
      <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor">
        <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
      </svg>
    ),
  },
  {
    label: "X (Twitter)",
    href: "#",
    svg: (
      <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
];

export function Footer() {
  return (
    <footer className="border-t bg-background">
      {/* Upper zone */}
      <div className="container mx-auto max-w-6xl px-4 py-12 md:py-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-[2fr_1fr_1fr_1fr]">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="inline-flex items-center gap-1.5 mb-3">
              <span className="font-bold text-base tracking-tight">
                SaaS
              </span>
              <span className="size-1.5 rounded-full bg-primary" />
              <span className="font-bold text-base tracking-tight">
                Starter
              </span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              A production-ready Next.js starter so you can focus on building
              your product, not the boilerplate.
            </p>
            {/* Socials */}
            <div className="flex gap-3 mt-5">
              {socials.map(({ svg, label, href }) => (
                <Link
                  key={label}
                  href={href}
                  aria-label={label}
                  className="size-8 rounded-md border border-border/60 flex items-center justify-center text-muted-foreground transition-colors hover:text-foreground hover:border-border"
                >
                  {svg}
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
        <div className="container mx-auto max-w-6xl px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} SaaS Starter. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            Built with{" "}
            <span className="text-foreground/60">Next.js · Prisma · Stripe</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
