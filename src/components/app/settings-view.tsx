"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Check, Eye, EyeOff } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const TABS = ["profile", "sender", "security", "language"] as const;
type Tab = (typeof TABS)[number];

function isValidTab(s: string | null): s is Tab {
  return TABS.includes(s as Tab);
}

// --- Schemas (module-level so they're not recreated on every render) ---

const profileSchema = z.object({
  name: z.string().min(1),
});

const senderSchema = z.object({
  senderName: z.string(),
  senderAddress: z.string(),
});

const passwordSchema = z
  .object({
    current: z.string().min(1),
    newPassword: z.string().min(8),
    confirm: z.string().min(1),
  })
  .refine((d) => d.newPassword === d.confirm, { path: ["confirm"] });

// --- Shared "coming soon" button wrapper ---

function ComingSoon({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex">
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

// --- Tab: Profile ---

function ProfileTab({
  userName,
  userEmail,
}: {
  userName: string;
  userEmail: string;
}) {
  const t = useTranslations("app.settings");
  const {
    register,
    reset,
    formState: { isDirty },
  } = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: userName },
  });

  useEffect(() => {
    if (userName) reset({ name: userName });
  }, [userName, reset]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("profile.title")}</CardTitle>
        <CardDescription>{t("profile.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="profile-name">{t("profile.name")}</Label>
          <Input
            id="profile-name"
            {...register("name")}
            placeholder={t("profile.namePlaceholder")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="profile-email">{t("profile.email")}</Label>
          <Input
            id="profile-email"
            type="email"
            value={userEmail}
            readOnly
            className="bg-muted text-muted-foreground cursor-default"
          />
          <p className="text-xs text-muted-foreground">{t("profile.emailNote")}</p>
        </div>
      </CardContent>
      <CardFooter className="justify-end border-t bg-muted/30">
        <ComingSoon label={t("comingSoon")}>
          <Button disabled={!isDirty}>{t("profile.save")}</Button>
        </ComingSoon>
      </CardFooter>
    </Card>
  );
}

// --- Tab: Sender defaults ---

function SenderTab() {
  const t = useTranslations("app.settings");
  const {
    register,
    formState: { isDirty },
  } = useForm<z.infer<typeof senderSchema>>({
    resolver: zodResolver(senderSchema),
    defaultValues: { senderName: "", senderAddress: "" },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("sender.title")}</CardTitle>
        <CardDescription>{t("sender.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="sender-name">{t("sender.name")}</Label>
          <Input
            id="sender-name"
            {...register("senderName")}
            placeholder={t("sender.namePlaceholder")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sender-address">{t("sender.address")}</Label>
          <Textarea
            id="sender-address"
            {...register("senderAddress")}
            placeholder={t("sender.addressPlaceholder")}
            rows={4}
            className="resize-none"
          />
        </div>
      </CardContent>
      <CardFooter className="justify-end border-t bg-muted/30">
        <ComingSoon label={t("comingSoon")}>
          <Button disabled={!isDirty}>{t("sender.save")}</Button>
        </ComingSoon>
      </CardFooter>
    </Card>
  );
}

// --- Tab: Security ---

function SecurityTab() {
  const t = useTranslations("app.settings");
  const [show, setShow] = useState({ current: false, new: false, confirm: false });

  const {
    register,
    formState: { isDirty },
  } = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current: "", newPassword: "", confirm: "" },
  });

  function toggle(field: keyof typeof show) {
    setShow((prev) => ({ ...prev, [field]: !prev[field] }));
  }

  function PasswordInput({
    id,
    field,
    labelKey,
  }: {
    id: string;
    field: "current" | "newPassword" | "confirm";
    labelKey: "security.current" | "security.new" | "security.confirm";
  }) {
    const showKey = field === "newPassword" ? "new" : (field as "current" | "confirm");
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>{t(labelKey)}</Label>
        <div className="relative">
          <Input
            id={id}
            type={show[showKey] ? "text" : "password"}
            {...register(field)}
            className="pr-10"
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => toggle(showKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {show[showKey] ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("security.title")}</CardTitle>
        <CardDescription>{t("security.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <PasswordInput id="pw-current" field="current" labelKey="security.current" />
        <PasswordInput id="pw-new" field="newPassword" labelKey="security.new" />
        <PasswordInput id="pw-confirm" field="confirm" labelKey="security.confirm" />
      </CardContent>
      <CardFooter className="justify-end border-t bg-muted/30">
        <ComingSoon label={t("comingSoon")}>
          <Button disabled={!isDirty}>{t("security.save")}</Button>
        </ComingSoon>
      </CardFooter>
    </Card>
  );
}

// --- Tab: Language ---

function LanguageTab() {
  const t = useTranslations("app.settings");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

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

  const locales = [
    { code: "en", label: t("language.en") },
    { code: "de", label: t("language.de") },
  ] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("language.title")}</CardTitle>
        <CardDescription>{t("language.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
          {locales.map(({ code, label }) => (
            <button
              key={code}
              onClick={() => switchLocale(code)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors",
                locale === code
                  ? "border-foreground bg-foreground/5 text-foreground"
                  : "border-input text-muted-foreground hover:border-foreground/40 hover:text-foreground"
              )}
            >
              {locale === code && <Check className="size-3.5 shrink-0" />}
              {label}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// --- Danger zone ---

function DangerZone() {
  const t = useTranslations("app.settings");

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="text-destructive">{t("danger.title")}</CardTitle>
        <CardDescription>{t("danger.description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium">{t("danger.deleteAccount")}</p>
          <p className="text-sm text-muted-foreground">{t("danger.deleteDescription")}</p>
        </div>
        <ComingSoon label={t("comingSoon")}>
          <Button variant="destructive" disabled className="shrink-0">
            {t("danger.deleteAccount")}
          </Button>
        </ComingSoon>
      </CardContent>
    </Card>
  );
}

// --- Main export ---

export function SettingsView() {
  const tPages = useTranslations("app.pages");
  const tSettings = useTranslations("app.settings");
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const activeTab: Tab = isValidTab(searchParams.get("tab"))
    ? (searchParams.get("tab") as Tab)
    : "profile";

  function setTab(tab: Tab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const userName = session?.user?.name ?? "";
  const userEmail = session?.user?.email ?? "";

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">
        {tPages("settings")}
      </h1>

      {/* Tab navigation — scrollable on mobile */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="flex min-w-max border-b">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setTab(tab)}
              className={cn(
                "shrink-0 px-4 py-2.5 -mb-px text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                activeTab === tab
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50"
              )}
            >
              {tSettings(`tabs.${tab}` as `tabs.${Tab}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Active tab content */}
      <div>
        {activeTab === "profile" && (
          <ProfileTab userName={userName} userEmail={userEmail} />
        )}
        {activeTab === "sender" && <SenderTab />}
        {activeTab === "security" && <SecurityTab />}
        {activeTab === "language" && <LanguageTab />}
      </div>

      {/* Danger zone — always visible at the bottom */}
      <DangerZone />
    </div>
  );
}
