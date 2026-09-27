// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { bandContext, renderApp } from "../../test/renderApp";
import type { SetlistItem } from "../../services/setlistsService";
import type { Song } from "../../services/songsService";
import type { SetlistTextInput } from "../../utils/setlistText";
import { EXPORT_OPTIONS_STORAGE_KEY } from "../../hooks/useSetlistTextExport";
import { SetlistTextExportModal } from "../SetlistTextExportModal";

const song = (id: string, title: string, overrides: Partial<Song> = {}): Song =>
  ({ id, band_id: 7, title, artist: "Strato", key: "Dm", tempo: 195, duration: 213, ...overrides }) as Song;

const songs = [song("s1", "La Furia"), song("s2", "Karma", { key: "Em", tempo: undefined, duration: 270 })];

const items: SetlistItem[] = [
  { type: "section", id: "sec", label: "Set 1", position: 0 },
  { type: "song", song_id: "s1", position: 1 },
  { type: "break", id: "brk", label: "Break", duration: 10, position: 2 },
  { type: "song", song_id: "s2", position: 3 },
] as SetlistItem[];

const baseInput = (overrides: Partial<SetlistTextInput> = {}): SetlistTextInput => ({
  name: "Strato",
  items,
  songsById: new Map(songs.map((s) => [s.id, s])),
  show: { name: "Fest", event_date: "2026-10-10", venue: "Teatro" },
  ...overrides,
});

const renderModal = (input = baseInput()) =>
  renderApp(<SetlistTextExportModal isOpen onClose={vi.fn()} input={input} />, { ctx: bandContext() });

const preview = () => screen.getByLabelText("Preview").textContent ?? "";

describe("SetlistTextExportModal", () => {
  const writeText = vi.fn<(text: string) => Promise<void>>();

  beforeEach(() => {
    localStorage.clear();
    writeText.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  });
  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(navigator, "share");
  });

  it("opens on the technical layout and switching layout updates the preview", async () => {
    renderModal();
    expect(screen.getByRole("radio", { name: /Technical/ }).getAttribute("aria-checked")).toBe("true");
    expect(preview()).toContain("Start");

    await userEvent.click(screen.getByRole("radio", { name: /To paste in a chat/ }));
    expect(preview()).toMatch(/^\*Strato\*/);
    expect(preview()).toContain("*Set 1*");

    await userEvent.click(screen.getByRole("radio", { name: /To print or read on stage/ }));
    expect(preview()).toMatch(/^STRATO\n/);
  });

  it("copies exactly the preview text", async () => {
    renderModal();
    await userEvent.click(screen.getByRole("radio", { name: /To paste in a chat/ }));
    await userEvent.click(screen.getByRole("button", { name: /Copy/ }));

    expect(writeText).toHaveBeenCalledWith(preview());
    expect(await screen.findByRole("button", { name: /Copied/ })).toBeTruthy();
  });

  it("hides Share without navigator.share", () => {
    renderModal();
    expect(screen.queryByRole("button", { name: /Share/ })).toBeNull();
  });

  it("shares title and text, and ignores a closed share sheet", async () => {
    const share = vi.fn().mockRejectedValue(Object.assign(new Error("closed"), { name: "AbortError" }));
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    renderModal();

    await userEvent.click(screen.getByRole("button", { name: /Share/ }));
    expect(share).toHaveBeenCalledWith({ title: "Strato", text: preview() });
    expect(screen.queryByText("Couldn't share the setlist")).toBeNull();
  });

  it("remembers layout and options across reopenings", async () => {
    renderModal();
    await userEvent.click(screen.getByRole("radio", { name: /To paste in a chat/ }));
    await userEvent.click(screen.getByRole("button", { name: /Customize/ }));
    await userEvent.click(screen.getByLabelText("Include song keys"));
    expect(preview()).not.toContain("Dm");
    cleanup();

    renderModal();
    expect(screen.getByRole("radio", { name: /To paste in a chat/ }).getAttribute("aria-checked")).toBe("true");
    expect(preview()).toMatch(/^\*Strato\*/);
    expect(preview()).not.toContain("Dm");
    expect(JSON.parse(localStorage.getItem(EXPORT_OPTIONS_STORAGE_KEY) ?? "{}")).toMatchObject({
      layout: "message",
      key: false,
    });
  });

  it("falls back to the defaults on corrupt stored options", () => {
    localStorage.setItem(EXPORT_OPTIONS_STORAGE_KEY, "{not json");
    renderModal();
    expect(screen.getByRole("radio", { name: /Technical/ }).getAttribute("aria-checked")).toBe("true");
  });

  it("resets the options to the layout's defaults", async () => {
    renderModal();
    await userEvent.click(screen.getByRole("button", { name: /Customize/ }));
    await userEvent.click(screen.getByLabelText("Include song keys"));
    expect(preview()).not.toContain("Dm");

    await userEvent.click(screen.getByRole("button", { name: "Reset to layout defaults" }));
    await waitFor(() => expect(preview()).toContain("Dm"));
  });

  it("offers the show option only with a linked show, and start times only in technical", async () => {
    renderModal(baseInput({ show: undefined }));
    await userEvent.click(screen.getByRole("button", { name: /Customize/ }));
    expect(screen.queryByLabelText("Include linked show")).toBeNull();
    expect(screen.getByLabelText("Include start times")).toBeTruthy();

    await userEvent.click(screen.getByRole("radio", { name: /To paste in a chat/ }));
    expect(screen.queryByLabelText("Include start times")).toBeNull();
    cleanup();
    localStorage.clear();

    renderModal();
    await userEvent.click(screen.getByRole("button", { name: /Customize/ }));
    expect(screen.getByLabelText("Include linked show")).toBeTruthy();
    expect(preview()).toContain("Fest");
  });
});
