// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { useState } from "react";
import { bandContext, renderApp } from "../../test/renderApp";
import { IsoCodeOptions } from "../IsoCodeOptions";
import { toSelectValue, type IsoKind } from "../../lib/isoCodes";

function Harness({ kind, initial }: { kind: IsoKind; initial: string | null }) {
  const [value, setValue] = useState(toSelectValue(kind, initial));
  return (
    <>
      <select aria-label="field" value={value} onChange={(e) => setValue(e.target.value)}>
        <IsoCodeOptions kind={kind} value={value} />
      </select>
      <output data-testid="value">{value}</output>
    </>
  );
}

const select = () => screen.getByRole("combobox", { name: "field" }) as HTMLSelectElement;
const optionTexts = () => [...select().options].map((o) => o.textContent);

describe("IsoCodeOptions", () => {
  it("a stored code selects its localised name; no Keep option", () => {
    renderApp(<Harness kind="region" initial="mx" />, { ctx: bandContext() });
    expect(select().value).toBe("MX");
    expect(select().selectedOptions[0].textContent).toBe("Mexico");
    expect(optionTexts().some((text) => text?.startsWith("Keep"))).toBe(false);
    expect(optionTexts()[0]).toBe("(none)");
  });

  it("legacy free text is kept as an option (AC7) and replaced by a code when picked", () => {
    renderApp(<Harness kind="region" initial="Inglaterra" />, { ctx: bandContext() });
    expect(select().selectedOptions[0].textContent).toBe('Keep "Inglaterra"');
    fireEvent.change(select(), { target: { value: "GB" } });
    expect(screen.getByTestId("value").textContent).toBe("GB");
    expect(optionTexts().some((text) => text?.startsWith("Keep"))).toBe(false);
  });

  it("languages: empty value selects (none)", () => {
    renderApp(<Harness kind="language" initial={null} />, { ctx: bandContext() });
    expect(select().value).toBe("");
    expect(optionTexts()).toContain("Spanish");
  });
});
