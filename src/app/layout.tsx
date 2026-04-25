import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "InvoiceFlow — Invoicing that gets out of your way.",
    template: "%s | InvoiceFlow",
  },
  description:
    "GoBD-compliant invoice management for DACH freelancers and small businesses. Create, send, and track invoices in under 60 seconds. PDF export included.",
  openGraph: {
    title: "InvoiceFlow — Invoicing that gets out of your way.",
    description:
      "GoBD-compliant invoice management for DACH freelancers and small businesses. Create, send, and track invoices in under 60 seconds.",
    url: "https://invoiceflow.dev",
    siteName: "InvoiceFlow",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "InvoiceFlow — Invoicing that gets out of your way.",
    description:
      "GoBD-compliant invoice management for DACH freelancers and small businesses.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} scroll-smooth`} suppressHydrationWarning>
      <body className="antialiased">
        <Providers>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            {children}
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}