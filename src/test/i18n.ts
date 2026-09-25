import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../i18n/locales/en.json";

/** A synchronous English i18next instance for component tests. */
export function createTestI18n() {
  const i18n = i18next.createInstance();
  void i18n.use(initReactI18next).init({
    lng: "en",
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
    initImmediate: false,
  });
  return i18n;
}
