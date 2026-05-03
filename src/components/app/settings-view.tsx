"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useSession, signOut } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ApiError } from "@/lib/api/errors";
import { useMe, useUpdateProfile, useChangePassword, useDeleteAccount } from "@/lib/api/hooks/useMe";

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

function ProfileTab() {
  const t = useTranslations("app.settings");
  const { data: me, isLoading } = useMe();
  const updateProfile = useUpdateProfile();

  const {
    register,
    reset,
    handleSubmit,
    formState: { isDirty, errors },
  } = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: me?.name ?? "" },
  });

  useEffect(() => {
    if (me?.name != null) reset({ name: me.name });
  }, [me?.name, reset]);

  async function onSubmit(values: z.infer<typeof profileSchema>) {
    await updateProfile.mutateAsync({ name: values.name });
    reset(values);
    toast.success(t("profile.saved"));
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-48 mt-1" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("profile.title")}</CardTitle>
        <CardDescription>{t("profile.description")}</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="profile-name">{t("profile.name")}</Label>
            <Input
              id="profile-name"
              {...register("name")}
              placeholder={t("profile.namePlaceholder")}
            />
            {errors.name && (
              <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-email">{t("profile.email")}</Label>
            <Input
              id="profile-email"
              type="email"
              value={me?.email ?? ""}
              readOnly
              className="bg-muted text-muted-foreground cursor-default"
            />
            <p className="text-xs text-muted-foreground">{t("profile.emailNote")}</p>
          </div>
        </CardContent>
        <CardFooter className="justify-end border-t bg-muted/30">
          <Button
            type="submit"
            disabled={!isDirty || updateProfile.isPending}
          >
            {updateProfile.isPending ? t("profile.saving") : t("profile.save")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

// --- Tab: Sender defaults ---

function SenderTab() {
  const t = useTranslations("app.settings");
  const { data: me, isLoading } = useMe();
  const updateProfile = useUpdateProfile();

  const {
    register,
    reset,
    handleSubmit,
    formState: { isDirty, errors },
  } = useForm<z.infer<typeof senderSchema>>({
    resolver: zodResolver(senderSchema),
    defaultValues: {
      senderName: me?.defaultSenderName ?? "",
      senderAddress: me?.defaultSenderAddress ?? "",
    },
  });

  useEffect(() => {
    reset({
      senderName: me?.defaultSenderName ?? "",
      senderAddress: me?.defaultSenderAddress ?? "",
    });
  }, [me?.defaultSenderName, me?.defaultSenderAddress, reset]);

  async function onSubmit(values: z.infer<typeof senderSchema>) {
    await updateProfile.mutateAsync({
      defaultSenderName: values.senderName,
      defaultSenderAddress: values.senderAddress,
    });
    reset(values);
    toast.success(t("sender.saved"));
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-64 mt-1" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("sender.title")}</CardTitle>
        <CardDescription>{t("sender.description")}</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sender-name">{t("sender.name")}</Label>
            <Input
              id="sender-name"
              {...register("senderName")}
              placeholder={t("sender.namePlaceholder")}
            />
            {errors.senderName && (
              <p className="mt-1 text-xs text-destructive">{errors.senderName.message}</p>
            )}
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
            {errors.senderAddress && (
              <p className="mt-1 text-xs text-destructive">{errors.senderAddress.message}</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="justify-end border-t bg-muted/30">
          <Button
            type="submit"
            disabled={!isDirty || updateProfile.isPending}
          >
            {updateProfile.isPending ? t("sender.saving") : t("sender.save")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

// --- Tab: Security ---

function SecurityTab() {
  const t = useTranslations("app.settings");
  const changePassword = useChangePassword();
  const [show, setShow] = useState({ current: false, new: false, confirm: false });

  const schema = useMemo(
    () =>
      z
        .object({
          current: z.string().min(1),
          newPassword: z.string().min(8, t("security.errors.passwordTooShort")),
          confirm: z.string().min(1),
        })
        .refine((d) => d.newPassword === d.confirm, {
          path: ["confirm"],
          message: t("security.errors.passwordMismatch"),
        }),
    [t]
  );

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { isDirty, errors },
  } = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(schema),
    defaultValues: { current: "", newPassword: "", confirm: "" },
  });

  async function onSubmit(values: z.infer<typeof passwordSchema>) {
    try {
      await changePassword.mutateAsync({
        currentPassword: values.current,
        newPassword: values.newPassword,
      });
      reset({ current: "", newPassword: "", confirm: "" });
      toast.success(t("security.saved"));
    } catch (err) {
      if (err instanceof ApiError && err.isBadRequest) {
        const body = err.body as { error?: string } | null;
        if (body?.error === "invalid_current_password") {
          setError("current", {
            type: "server",
            message: t("security.errors.invalidCurrent"),
          });
          return;
        }
      }
      toast.error(t("security.error"));
    }
  }

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
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardHeader>
          <CardTitle>{t("security.title")}</CardTitle>
          <CardDescription>{t("security.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <PasswordInput id="pw-current" field="current" labelKey="security.current" />
          {errors.current && (
            <p className="text-sm text-destructive">{errors.current.message}</p>
          )}
          <PasswordInput id="pw-new" field="newPassword" labelKey="security.new" />
          {errors.newPassword && (
            <p className="text-sm text-destructive">{errors.newPassword.message}</p>
          )}
          <PasswordInput id="pw-confirm" field="confirm" labelKey="security.confirm" />
          {errors.confirm && (
            <p className="text-sm text-destructive">{errors.confirm.message}</p>
          )}
        </CardContent>
        <CardFooter className="justify-end border-t bg-muted/30">
          <Button type="submit" disabled={!isDirty || changePassword.isPending}>
            {changePassword.isPending ? t("security.saving") : t("security.save")}
          </Button>
        </CardFooter>
      </form>
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
  const { data: user } = useMe();
  const deleteAccount = useDeleteAccount();
  const [open, setOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");

  function handleOpenChange(next: boolean) {
    if (!next) setConfirmEmail("");
    setOpen(next);
  }

  async function handleDelete() {
    try {
      await deleteAccount.mutateAsync();
      await signOut({ callbackUrl: "/auth/login" });
    } catch {
      toast.error(t("danger.error"));
    }
  }

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
        <AlertDialog open={open} onOpenChange={handleOpenChange}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="shrink-0">
              {t("danger.deleteAccount")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("danger.confirmTitle")}</AlertDialogTitle>
              <AlertDialogDescription>{t("danger.confirmDescription")}</AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              placeholder={t("danger.confirmEmailPlaceholder")}
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              type="email"
              autoComplete="off"
            />
            <AlertDialogFooter>
              <AlertDialogCancel>{t("danger.cancel")}</AlertDialogCancel>
              <Button
                variant="destructive"
                disabled={confirmEmail !== user?.email || deleteAccount.isPending}
                onClick={handleDelete}
              >
                {deleteAccount.isPending ? "…" : t("danger.confirmAction")}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

// --- Main export ---

export function SettingsView() {
  const tPages = useTranslations("app.pages");
  const tSettings = useTranslations("app.settings");
  useSession(); // kept as fallback; ProfileTab uses useMe() directly
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
          <ProfileTab />
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
