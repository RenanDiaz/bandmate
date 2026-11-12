// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { bandContext, renderApp } from "../../test/renderApp";
import en from "../../i18n/locales/en.json";
import es from "../../i18n/locales/es.json";
import type { Song } from "../../services/songsService";

vi.mock("../../services/songsService", () => ({
  createSong: vi.fn(),
  getBandSongs: vi.fn(),
}));

import { createSong, getBandSongs } from "../../services/songsService";
import { ImportSongsModal } from "../ImportSongsModal";

const csv = (text: string) => new File([text], "songs.csv", { type: "text/csv" });

const renderModal = () =>
  renderApp(<ImportSongsModal isOpen onClose={vi.fn()} onImportComplete={vi.fn()} bandId={7} />, {
    ctx: bandContext(),
  });

const upload = async (file: File) => {
  await userEvent.upload(document.getElementById("csv-file") as HTMLInputElement, file);
};

describe("ImportSongsModal", () => {
  beforeEach(() => {
    vi.mocked(createSong).mockReset().mockResolvedValue({} as Song);
    vi.mocked(getBandSongs)
      .mockReset()
      .mockResolvedValue([{ id: "x", band_id: 7, title: "Karma", artist: "Strato" } as Song]);
  });
  afterEach(cleanup);

  it("renders its copy through i18n, with the app's buttons", () => {
    renderModal();
    expect(screen.getByText("Import Songs from CSV")).toBeTruthy();
    expect(screen.getByText("Drop CSV file here")).toBeTruthy();

    const cancel = screen.getByRole("button", { name: "Cancel" });
    expect(cancel.getAttribute("type")).toBe("button");
    expect(cancel.className).not.toMatch(/\bbtn\b/);
  });

  it("previews the rows, imports the new ones and counts the duplicates", async () => {
    renderModal();
    await upload(csv("Title,Artist\nLa Furia,Strato\nKarma,Strato\n,Nobody\n"));

    expect(await screen.findByText("Preview (2 valid songs)")).toBeTruthy();
    expect(screen.getAllByText("Missing title")).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: "Import 2 songs" }));

    await waitFor(() => expect(screen.getByText(/Imported 1 song!/)).toBeTruthy());
    expect(screen.getByText(/\(1 duplicate skipped\)/)).toBeTruthy();
    expect(screen.getByText("Row 3: Missing title")).toBeTruthy();
    expect(createSong).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createSong).mock.calls[0][0]).toMatchObject({ band_id: 7, title: "La Furia" });
  });

  it("has every songs.import key in Spanish too", () => {
    expect(Object.keys(es.songs.import).sort()).toEqual(Object.keys(en.songs.import).sort());
  });
});
