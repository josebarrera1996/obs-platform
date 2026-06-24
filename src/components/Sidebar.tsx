"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Sun,
  Moon,
  Settings,
  Activity,
  AlertTriangle,
  Heart,
  Database,
  Package,
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSettingsStore } from "@/store/settings";
import { useTranslation } from "react-i18next";

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const { theme, setTheme } = useTheme();
  const awsAccounts = useSettingsStore((s) => s.accounts);
  const activeCredentialId = useSettingsStore((s) => s.activeCredentialId);
  const fetchAwsAccounts = useSettingsStore((s) => s.fetchAwsAccounts);

  useEffect(() => {
    if (activeCredentialId) {
      fetchAwsAccounts(activeCredentialId);
    }
  }, [activeCredentialId, fetchAwsAccounts]);

  const navItems = [
    {
      label: t("dashboard"),
      href: "/",
      icon: LayoutDashboard,
    },
    {
      label: t("products"),
      href: "/products",
      icon: Package,
    },
    {
      label: t("pipeline"),
      href: "/pipeline",
      icon: Database,
    },
    {
      label: t("insights"),
      href: "/insights",
      icon: Activity,
    },
    {
      label: t("incidents"),
      href: "/incidents",
      icon: AlertTriangle,
    },
    {
      label: t("status"),
      href: "/status",
      icon: Heart,
    },
    {
      label: t("settings"),
      href: "/settings",
      icon: Settings,
    },
  ];

  return (
    <aside className="relative flex h-screen w-[--sidebar-width] flex-col border-r bg-sidebar transition-[width] duration-200">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
        <div className="flex items-center gap-2">
          <Cloud className="h-5 w-5 text-sidebar-primary" />
          {!collapsed && (
            <span className="text-sm font-semibold text-sidebar-foreground">
              ObsPlatform
            </span>
          )}
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rounded-md p-1 text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-2 py-3">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger
                  render={
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      )}
                    />
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </TooltipTrigger>
                {collapsed && (
                  <TooltipContent side="right">{item.label}</TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </nav>

        <Separator className="my-3" />

        {/* Accounts Section */}
        {!collapsed && (
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
            {t("accounts")}
          </p>
        )}
        <nav className="space-y-1">
          {awsAccounts.length === 0 && (
            <p className="px-3 py-2 text-xs text-sidebar-foreground/40">
              {activeCredentialId ? t("no_accounts_found") : t("add_credentials_in_settings")}
            </p>
          )}
          {awsAccounts.map((account) => {
            const isActive = pathname === `/accounts/${account.id}`;
            return (
              <Tooltip key={account.id}>
                <TooltipTrigger
                  render={
                    <Link
                      href={`/accounts/${account.id}`}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      )}
                    />
                  }
                >
                  <Cloud className="h-4 w-4 shrink-0" />
                  <StatusDot status={account.status} />
                  {!collapsed && (
                    <span className="truncate">{account.alias || account.accountId}</span>
                  )}
                </TooltipTrigger>
                {collapsed && (
                  <TooltipContent side="right">
                    {account.alias || account.accountId}
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </nav>

        <Separator className="my-3" />

        {/* Bottom section */}
        <nav className="space-y-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  {theme === "dark" ? (
                    <Sun className="h-4 w-4 shrink-0" />
                  ) : (
                    <Moon className="h-4 w-4 shrink-0" />
                  )}
                  {!collapsed && (
                    <span>{theme === "dark" ? t("light_mode") : t("dark_mode")}</span>
                  )}
                </button>
              }
            />
            {collapsed && (
              <TooltipContent side="right">
                {t("toggle_mode", { mode: theme === "dark" ? t("light_mode") : t("dark_mode") })}
              </TooltipContent>
            )}
          </Tooltip>
        </nav>
      </ScrollArea>
    </aside>
  );
}

function StatusDot({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    healthy: "bg-emerald-500",
    degraded: "bg-amber-500",
    critical: "bg-red-500",
  };
  const color = colorMap[status] || "bg-gray-400";

  return (
    <span className="relative flex h-2 w-2">
      <span
        className={cn(
          "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
          color
        )}
      />
      <span
        className={cn(
          "relative inline-flex h-2 w-2 rounded-full",
          color
        )}
      />
    </span>
  );
}