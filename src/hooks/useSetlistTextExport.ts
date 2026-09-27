import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../context/useToast";
import {
  SETLIST_TEXT_DEFAULTS,
  formatSetlistText,
  parseStoredExportOptions,
  setlistFileName,
  type SetlistTextInput,
  type SetlistTextLayout,
  type SetlistTextOptions,
} from "../utils/setlistText";

/** Per device, not per setlist (spec decision 8). */
export const EXPORT_OPTIONS_STORAGE_KEY = "bandmate_setlist_export_options";

export type SetlistTextFlag = Exclude<keyof SetlistTextOptions, "layout">;

function readStoredOptions(): SetlistTextOptions {
  try {
    return parseStoredExportOptions(localStorage.getItem(EXPORT_OPTIONS_STORAGE_KEY));
  } catch {
    return parseStoredExportOptions(null);
  }
}

function writeStoredOptions(options: SetlistTextOptions): void {
  try {
    localStorage.setItem(EXPORT_OPTIONS_STORAGE_KEY, JSON.stringify(options));
  } catch {
    // Storage blocked or full: the options just don't persist.
  }
}

/**
 * Browser side of the setlist text export (spec: docs/specs/setlist-text-export.md §3):
 * remembered options, the formatted text, Copy, Share and Download. The
 * formatting itself stays in the pure `formatSetlistText`.
 */
export function useSetlistTextExport(input: SetlistTextInput) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const [options, setOptions] = useState<SetlistTextOptions>(readStoredOptions);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  const update = useCallback((next: SetlistTextOptions) => {
    setOptions(next);
    writeStoredOptions(next);
  }, []);

  const setLayout = (layout: SetlistTextLayout) => update({ ...SETLIST_TEXT_DEFAULTS[layout] });
  const toggle = (flag: SetlistTextFlag) => update({ ...options, [flag]: !options[flag] });
  const resetToDefaults = () => update({ ...SETLIST_TEXT_DEFAULTS[options.layout] });

  const text = useMemo(
    () => formatSetlistText(input, options, t, i18n.language),
    [input, options, t, i18n.language],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy setlist text:", error);
      toast.error(t("setlists.export.copyError"));
    }
  };

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  // Text, not a file: file sharing support is uneven on iOS (decision 7).
  const share = async () => {
    try {
      await navigator.share({ title: input.name, text });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      console.error("Failed to share setlist text:", error);
      toast.error(t("setlists.export.shareError"));
    }
  };

  const download = () => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = setlistFileName(input.name);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return { options, setLayout, toggle, resetToDefaults, text, copy, copied, canShare, share, download };
}
