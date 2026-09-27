import type { SongSignals } from "../../utils/songSignals";

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Day + short month in the app locale; the year only when it is not `today`'s. */
export function formatSignalDate(date: string, locale: string, today: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const sameYear = date.slice(0, 4) === today.slice(0, 4);
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(new Date(year, month - 1, day));
}

/** The picker row's history line (spec §3.1). */
export function formatSignalLine(signals: SongSignals | undefined, t: Translate, locale: string, today: string): string {
  if (signals && signals.timesPlayed > 0 && signals.lastPlayedAt && signals.lastPlayedShow) {
    return t("setlists.picker.signals.played", {
      count: signals.timesPlayed,
      place: signals.lastPlayedShow.venue ?? signals.lastPlayedShow.name,
      date: formatSignalDate(signals.lastPlayedAt, locale, today),
    });
  }
  if (signals && signals.timesInSetlists > 0) {
    return t("setlists.picker.signals.inSetlists", { count: signals.timesInSetlists });
  }
  return t("setlists.picker.signals.never");
}
