"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";

const navLinks = [
  { name: "Features", href: "#features" },
  { name: "Pricing", href: "#pricing" },
  { name: "Docs", href: "#" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto max-w-6xl px-4">
        <div className="flex h-14 items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-1.5 shrink-0">
            <span className="font-bold text-sm tracking-tight">SaaS</span>
            <span className="size-1.5 rounded-full bg-primary" />
            <span className="font-bold text-sm tracking-tight">Starter</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map(({ name, href }) => (
              <Link
                key={name}
                href={href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {name}
              </Link>
            ))}
          </nav>

          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-2">
            <ThemeToggle />
            <Link href="/auth/login">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link href="/auth/register">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>

          {/* Mobile actions */}
          <div className="flex md:hidden items-center gap-1">
            <ThemeToggle />
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open menu">
                  <Menu className="size-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 p-0">
                {/* Sheet header with logo */}
                <div className="flex items-center gap-1.5 px-5 py-4 border-b border-border/50">
                  <span className="font-bold text-sm tracking-tight">SaaS</span>
                  <span className="size-1.5 rounded-full bg-primary" />
                  <span className="font-bold text-sm tracking-tight">Starter</span>
                </div>

                {/* Nav links */}
                <nav className="flex flex-col px-3 py-3">
                  {navLinks.map(({ name, href }) => (
                    <SheetClose key={name} asChild>
                      <Link
                        href={href}
                        className="px-3 py-2.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        {name}
                      </Link>
                    </SheetClose>
                  ))}
                </nav>

                {/* CTA buttons */}
                <div className="px-5 pt-2 pb-6 border-t border-border/50 mt-2 flex flex-col gap-2">
                  <SheetClose asChild>
                    <Link href="/auth/login">
                      <Button variant="outline" className="w-full">Sign In</Button>
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link href="/auth/register">
                      <Button className="w-full">Get Started</Button>
                    </Link>
                  </SheetClose>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
