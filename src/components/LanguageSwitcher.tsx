"use client";

import { useEffect, useState } from "react";
import i18n from "@/i18n";
import { Button } from "@/components/ui/button";

export default function LanguageSwitcher() {
  const [lang, setLang] = useState<string>(i18n.language || "en");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("lang") : null;
    if (stored && stored !== lang) {
      i18n.changeLanguage(stored).then(() => setLang(stored));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = async () => {
    const next = lang === "en" ? "es" : "en";
    await i18n.changeLanguage(next);
    try {
      localStorage.setItem("lang", next);
    } catch (e) {
      // ignore
    }
    setLang(next);
  };

  return (
    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={toggle}>
      {lang === "en" ? "ES" : "EN"}
      <span className="hidden sm:inline ml-2">{lang === "en" ? "Español" : "English"}</span>
    </Button>
  );
}
