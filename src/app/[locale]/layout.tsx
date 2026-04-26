import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { ThemeProvider } from "@/components/theme-provider";
import { Providers } from "@/components/providers";
import { QueryProvider } from "@/components/providers/query-provider";
import { routing } from "@/i18n/routing";
import { Toaster } from "sonner";
import "../globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common.brand" });

  return {
    title: {
      default: `${t("name")} — ${t("tagline")}`,
      template: `%s | ${t("name")}`,
    },
    description:
      locale === "de"
        ? "GoBD-konforme Rechnungsverwaltung für DACH-Freelancer und kleine Unternehmen. Rechnungen erstellen, versenden und verfolgen in unter 60 Sekunden."
        : "GoBD-compliant invoice management for DACH freelancers and small businesses. Create, send, and track invoices in under 60 seconds.",
    alternates: {
      canonical:
        locale === "de" ? "https://invoiceflow.dev/de" : "https://invoiceflow.dev",
      languages: {
        en: "https://invoiceflow.dev",
        de: "https://invoiceflow.dev/de",
      },
    },
    openGraph: {
      siteName: "InvoiceFlow",
      locale: locale === "de" ? "de_DE" : "en_US",
      type: "website",
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} scroll-smooth`}
      suppressHydrationWarning
    >
      <body className="antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            <QueryProvider>
              <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
                {children}
                <Toaster richColors closeButton />
              </ThemeProvider>
            </QueryProvider>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
