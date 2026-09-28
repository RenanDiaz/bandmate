import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nextProvider } from "react-i18next";
import { createTestI18n } from "../../../test/i18n";
import { NotificationSettingsBody } from "../NotificationSettingsBody";
import type { NotificationSettingsBodyProps } from "../NotificationSettingsBody";

const i18n = createTestI18n();

function render(element: ReactElement): string {
  return renderToStaticMarkup(<I18nextProvider i18n={i18n}>{element}</I18nextProvider>)
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ");
}

const noop = () => {};
function props(overrides: Partial<NotificationSettingsBodyProps> = {}): NotificationSettingsBodyProps {
  return {
    status: "off",
    deviceBusy: null,
    deviceNotice: null,
    onTurnOn: noop,
    onTurnOff: noop,
    bands: [],
    bandsFailed: false,
    savingBandIds: new Set(),
    onToggleBand: noop,
    onRetryBands: noop,
    ...overrides,
  };
}

describe("NotificationSettingsBody (spec §2.2)", () => {
  it("off: explains and offers Turn on", () => {
    const text = render(<NotificationSettingsBody {...props()} />);
    expect(text).toContain("adds a show, a rehearsal or a setlist");
    expect(text).toContain("moves or cancels a show or rehearsal");
    expect(text).toContain("Turn on");
    expect(text).not.toContain("Turn off");
  });

  it("on: says so and offers Turn off", () => {
    const text = render(<NotificationSettingsBody {...props({ status: "on" })} />);
    expect(text).toContain("On for this device.");
    expect(text).toContain("Turn off");
    expect(text).not.toContain("Turn on");
  });

  it("needs-install, denied and unsupported have no button", () => {
    for (const [status, copy] of [
      ["needs-install", "Add to Home Screen"],
      ["denied", "Notifications are blocked"],
      ["unsupported", "can't receive notifications"],
    ] as const) {
      const text = render(<NotificationSettingsBody {...props({ status })} />);
      expect(text).toContain(copy);
      expect(text).not.toContain("Turn on");
      expect(text).not.toContain("Turn off");
    }
  });

  it("shows the busy label and the device notices", () => {
    expect(render(<NotificationSettingsBody {...props({ deviceBusy: "on" })} />)).toContain("Turning on…");
    expect(render(<NotificationSettingsBody {...props({ deviceNotice: "dismissed" })} />)).toContain(
      "Notifications weren't allowed"
    );
    expect(render(<NotificationSettingsBody {...props({ deviceNotice: "subscribeFailed" })} />)).toContain(
      "Couldn't turn on notifications"
    );
  });

  it("lists one switch per band, on unless muted", () => {
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={i18n}>
        <NotificationSettingsBody
          {...props({
            bands: [
              { id: 1, name: "Los Tigres", muted: false },
              { id: 2, name: "Jazz Trio", muted: true },
            ],
            savingBandIds: new Set([2]),
          })}
        />
      </I18nextProvider>
    );
    expect(html).toContain("Notify me about Los Tigres");
    expect(html).toMatch(/id="notify-band-1"[^>]*checked=""/);
    expect(html).not.toMatch(/id="notify-band-2"[^>]*checked=""/);
    expect(html).toMatch(/disabled=""[^>]*id="notify-band-2"|id="notify-band-2"[^>]*disabled=""/);
  });

  it("a failed band load shows Retry instead of the switches", () => {
    const text = render(<NotificationSettingsBody {...props({ bands: null, bandsFailed: true })} />);
    expect(text).toContain("Couldn't load your band settings.");
    expect(text).toContain("Retry");
  });

  it("always carries the own-changes and on-stage note", () => {
    expect(render(<NotificationSettingsBody {...props({ status: null, bands: null })} />)).toContain(
      "You won't be notified about your own changes"
    );
  });
});
