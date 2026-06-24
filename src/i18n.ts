import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import es from "./locales/es.json";

const resources = {
  en: { translation: en },
  es: { translation: es },
};

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: typeof window !== "undefined" ? (localStorage.getItem("lang") || "en") : "en",
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  });
}

export default i18n;
