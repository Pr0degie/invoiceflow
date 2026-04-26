"use client";

import { signOut } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { usePathname, useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sun, Moon, Monitor, LogOut, Globe } from "lucide-react";

function getInitials(name?: string | null, email?: string | null) {
  if (name) {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "?";
}

interface UserMenuProps {
  name?: string | null;
  email?: string | null;
}

export function UserMenu({ name, email }: UserMenuProps) {
  const t = useTranslations("app.user");
  const tTheme = useTranslations("app.theme");
  const tLang = useTranslations("language");
  const { theme, setTheme } = useTheme();
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  function switchLocale(next: string) {
    if (next === locale) return;
    let newPath: string;
    if (next === "en") {
      newPath = pathname.replace(/^\/de(\/|$)/, "/") || "/";
    } else {
      const stripped = pathname.replace(/^\/de(\/|$)/, "/");
      newPath = `/de${stripped === "/" ? "" : stripped}`;
    }
    router.push(newPath);
  }

  async function handleSignOut() {
    await signOut({ callbackUrl: "/auth/login" });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Avatar size="sm" className="shrink-0">
            <AvatarFallback className="text-[10px] font-semibold bg-primary text-primary-foreground">
              {getInitials(name, email)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col items-start overflow-hidden">
            <span className="truncate text-xs font-medium text-foreground leading-tight">
              {name ?? email}
            </span>
            {name && email && (
              <span className="truncate text-[10px] text-muted-foreground leading-tight">
                {email}
              </span>
            )}
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56">
        <DropdownMenuLabel className="font-normal py-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium leading-none">{name}</span>
            <span className="text-xs text-muted-foreground leading-none mt-1">{email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2 text-sm">
            <Sun className="size-4" />
            {t("theme")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
              <DropdownMenuRadioItem value="light" className="gap-2 text-sm">
                <Sun className="size-4" />
                {tTheme("light")}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark" className="gap-2 text-sm">
                <Moon className="size-4" />
                {tTheme("dark")}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system" className="gap-2 text-sm">
                <Monitor className="size-4" />
                {tTheme("system")}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2 text-sm">
            <Globe className="size-4" />
            {t("language")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={locale} onValueChange={switchLocale}>
              <DropdownMenuRadioItem value="en" className="text-sm">
                {tLang("en")}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="de" className="text-sm">
                {tLang("de")}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="gap-2 text-sm cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
          onClick={handleSignOut}
        >
          <LogOut className="size-4" />
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
