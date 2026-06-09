"use client";

import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { SearchDialog } from "@/components/SearchDialog";
import { KeyboardShortcutsHelp } from "@/components/KeyboardShortcutsHelp";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto bg-muted/30 p-6">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>
      <SearchDialog />
      <KeyboardShortcutsHelp />
    </div>
  );
}
