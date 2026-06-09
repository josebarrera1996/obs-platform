"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

const shortcuts = [
  { keys: ["⌘", "K"], description: "Open search" },
  { keys: ["?"], description: "Show keyboard shortcuts" },
  { keys: ["G", "D"], description: "Go to Dashboard" },
  { keys: ["G", "I"], description: "Go to Incidents" },
  { keys: ["Esc"], description: "Close dialog / modal" },
];

export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't trigger when typing in an input
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true"
      ) {
        return;
      }

      if (e.key === "?") {
        e.preventDefault();
        setOpen(true);
      }

      if (e.key === "Escape" && open) {
        setOpen(false);
      }

      if (e.key === "d" && !e.metaKey && !e.ctrlKey) {
        // Only when "G" was pressed before
        if ((window as unknown as Record<string, unknown>)._lastGPress) {
          delete (window as unknown as Record<string, unknown>)._lastGPress;
          window.location.href = "/";
          return;
        }
      }

      if (e.key === "i" && !e.metaKey && !e.ctrlKey) {
        if ((window as unknown as Record<string, unknown>)._lastGPress) {
          delete (window as unknown as Record<string, unknown>)._lastGPress;
          window.location.href = "/incidents";
          return;
        }
      }

      if (e.key === "g" && !e.metaKey && !e.ctrlKey) {
        (window as unknown as Record<string, unknown>)._lastGPress = true;
        setTimeout(() => {
          delete (window as unknown as Record<string, unknown>)._lastGPress;
        }, 1000);
      }
    },
    [open]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (!open) {
      // cleanup
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md p-0 gap-0">
        <DialogTitle className="sr-only">Keyboard Shortcuts</DialogTitle>
        <div className="px-6 py-4 border-b border-border/40">
          <h2 className="text-sm font-semibold">Keyboard Shortcuts</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Press <kbd className="text-[10px] font-mono bg-muted px-1 rounded">?</kbd>{" "}
            anytime to show this panel
          </p>
        </div>
        <div className="px-6 py-4 space-y-3">
          {shortcuts.map((shortcut) => (
            <div
              key={shortcut.description}
              className="flex items-center justify-between"
            >
              <span className="text-sm">{shortcut.description}</span>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key, i) => (
                  <span key={i}>
                    <kbd className="inline-flex items-center justify-center min-w-[24px] h-5 rounded border border-border bg-muted px-1.5 text-[10px] font-mono text-muted-foreground">
                      {key}
                    </kbd>
                    {i < shortcut.keys.length - 1 && (
                      <span className="text-[10px] text-muted-foreground/50 mx-0.5">
                        then
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="px-6 py-3 border-t border-border/40 text-center">
          <p className="text-[10px] text-muted-foreground/60">
            Press <kbd className="text-[10px] font-mono bg-muted px-0.5 rounded">?</kbd>{" "}
            to toggle · Powered by ObsPortal
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
