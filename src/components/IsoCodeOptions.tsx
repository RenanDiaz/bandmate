import type { FC } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { isKnownCode, isoOptions, type IsoKind } from "../lib/isoCodes";

interface IsoCodeOptionsProps {
  kind: IsoKind;
  /** The select's current value (`toSelectValue`): "", a code or a legacy value. */
  value: string;
}

/**
 * The `<option>`s of a country or language select
 * (docs/specs/song-country-language.md §3.3): none, every code by its name in
 * the UI language, and "Keep "<value>"" when the current value is legacy free
 * text, so editing an old song never drops it. Rendered inside each form's own
 * styled `<select>`.
 */
export const IsoCodeOptions: FC<IsoCodeOptionsProps> = ({ kind, value }) => {
  const { t, i18n } = useTranslation();
  const options = useMemo(() => isoOptions(kind, i18n.language), [kind, i18n.language]);
  const legacy = value.trim() !== "" && !isKnownCode(kind, value);

  return (
    <>
      <option value="">{t("common.none")}</option>
      {legacy && <option value={value}>{t("songs.keepValue", { value })}</option>}
      {options.map((option) => (
        <option key={option.code} value={option.code}>
          {option.name}
        </option>
      ))}
    </>
  );
};
