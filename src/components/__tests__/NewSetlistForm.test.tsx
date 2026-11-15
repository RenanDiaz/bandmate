// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { bandContext, renderApp } from "../../test/renderApp";
import type { Setlist } from "../../services/setlistsService";

vi.mock("../../services/setlistsService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/setlistsService")>()),
  createSetlist: vi.fn(),
  duplicateSetlist: vi.fn(),
}));

const { createSetlist, duplicateSetlist } = await import("../../services/setlistsService");
const { NewSetlistForm } = await import("../NewSetlistForm");

const source = (overrides: Partial<Setlist> = {}): Setlist => ({
  id: "src-1",
  band_id: 7,
  user_id: "u1",
  name: "Friday",
  description: "Bar gig",
  songs: [{ type: "song", song_id: "a", position: 0 }],
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
  ...overrides,
});

function renderForm(setlists: Setlist[] = [source()]) {
  const onSetlistCreated = vi.fn();
  renderApp(<NewSetlistForm bandId={7} setlists={setlists} onSetlistCreated={onSetlistCreated} />, {
    ctx: bandContext(),
    path: "/setlists",
  });
  fireEvent.click(screen.getByRole("button", { name: /Create New Setlist/i }));
  return onSetlistCreated;
}

const location = () => screen.getByTestId("location").textContent;

beforeEach(() => {
  vi.mocked(createSetlist).mockReset();
  vi.mocked(duplicateSetlist).mockReset();
});

describe("NewSetlistForm", () => {
  it("creates a blank setlist and opens its editor", async () => {
    vi.mocked(createSetlist).mockResolvedValue(source({ id: "new-1", songs: [] }));
    const onSetlistCreated = renderForm();

    fireEvent.change(screen.getByLabelText(/Setlist Name/i), { target: { value: "Saturday" } });
    fireEvent.click(screen.getByRole("button", { name: /Add Setlist/i }));

    await waitFor(() => expect(location()).toBe("/setlists/new-1/edit"));
    expect(createSetlist).toHaveBeenCalledWith(expect.objectContaining({ name: "Saturday", band_id: 7, songs: [] }));
    expect(onSetlistCreated).toHaveBeenCalled();
  });

  it("creates from the Two sets + break template (AC9)", async () => {
    vi.mocked(createSetlist).mockResolvedValue(source({ id: "new-2" }));
    renderForm();

    fireEvent.click(screen.getByRole("radio", { name: "Template" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Choose a template" }), { target: { value: "two-sets-break" } });
    fireEvent.change(screen.getByLabelText(/Setlist Name/i), { target: { value: "Wedding" } });
    fireEvent.click(screen.getByRole("button", { name: /Add Setlist/i }));

    await waitFor(() => expect(location()).toBe("/setlists/new-2/edit"));
    const { songs } = vi.mocked(createSetlist).mock.calls[0][0];
    expect(songs).toMatchObject([
      { type: "section", label: "Set 1" },
      { type: "break", label: "Break", duration: 15 },
      { type: "section", label: "Set 2" },
    ]);
  });

  it("copies a setlist: pre-fills name and description, calls duplicateSetlist and opens the copy (AC9)", async () => {
    vi.mocked(duplicateSetlist).mockResolvedValue(source({ id: "copy-1" }));
    renderForm();

    fireEvent.click(screen.getByRole("radio", { name: "Copy of…" }));
    const add = screen.getByRole("button", { name: /Add Setlist/i }) as HTMLButtonElement;
    expect(add.disabled).toBe(true); // no source chosen yet

    fireEvent.change(screen.getByRole("combobox", { name: "Choose a setlist" }), { target: { value: "src-1" } });
    expect((screen.getByLabelText(/Setlist Name/i) as HTMLInputElement).value).toBe("Friday (copy)");
    expect((screen.getByLabelText(/Description/i) as HTMLTextAreaElement).value).toBe("Bar gig");

    fireEvent.click(add);
    await waitFor(() => expect(location()).toBe("/setlists/copy-1/edit"));
    expect(duplicateSetlist).toHaveBeenCalledWith("src-1", "Friday (copy)", { description: "Bar gig" });
    expect(createSetlist).not.toHaveBeenCalled();
  });

  it("disables Copy of… when there is nothing to copy", () => {
    renderForm([]);
    expect((screen.getByRole("radio", { name: "Copy of…" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
