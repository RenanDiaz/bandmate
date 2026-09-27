// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Setlist } from "../../services/setlistsService";
import { bandContext, renderApp } from "../../test/renderApp";
import { SetlistList } from "../SetlistList";

// The list only reads the offline badges through this hook; nothing here has a copy.
vi.mock("../../hooks/useOfflineDownload", () => ({ useOfflineSnapshotMetas: () => ({}) }));

const setlist = (id: string, name: string, songs = 2): Setlist =>
  ({
    id,
    band_id: 7,
    name,
    description: "",
    songs: Array.from({ length: songs }, (_, i) => ({ type: "song", song_id: `song-${i}`, position: i })),
    is_draft: false,
  }) as unknown as Setlist;

const lists = [setlist("s1", "Friday", 3), setlist("s2", "Empty", 0)];
const location = () => screen.getByTestId("location").textContent;

function renderList(canEdit = true) {
  const onDelete = vi.fn();
  renderApp(<SetlistList setlists={lists} onDelete={onDelete} canEdit={canEdit} />, {
    ctx: bandContext(),
    path: "/setlists",
  });
  return { onDelete };
}

afterEach(cleanup);

describe("SetlistList cards (spec §3)", () => {
  it("shows Perform on every card without hovering, disabled with no songs", () => {
    renderList();
    const performs = screen.getAllByRole("button", { name: "Perform" });
    expect(performs).toHaveLength(2);
    expect(performs[0]).toHaveProperty("disabled", false);
    expect(performs[1]).toHaveProperty("disabled", true);
    // Nothing on the card is hidden until hover: every Perform is visible now.
    performs.forEach((b) => expect(getComputedStyle(b).opacity).not.toBe("0"));
  });

  it("the name is a link to the detail and clicking the card body opens it", async () => {
    renderList();
    const link = screen.getByRole("link", { name: "Friday" });
    expect(link.getAttribute("href")).toBe("/setlists/s1");
    // The card body (here its icon) is the pointer target; the link is for keyboard and new tabs.
    await userEvent.click(document.querySelector(".bi-music-note-list")!);
    expect(location()).toBe("/setlists/s1");
  });

  it("Perform opens performance mode and does not open the detail", async () => {
    renderList();
    await userEvent.click(screen.getAllByRole("button", { name: "Perform" })[0]);
    expect(location()).toBe("/setlists/s1/perform");
  });

  it("More actions holds Edit and Delete for editors and is absent for guests", async () => {
    const { onDelete } = renderList();
    const more = screen.getAllByRole("button", { name: "More actions" });
    expect(more).toHaveLength(2);
    await userEvent.click(more[0]);
    const menu = screen.getByRole("menu");
    const items = Array.from(menu.querySelectorAll("button.dropdown-item")).map((el) => el.textContent?.trim());
    expect(items).toEqual(["Edit", "Delete"]);
    expect(menu.querySelectorAll(".dropdown-divider")).toHaveLength(1);

    await userEvent.click(within(menu).getByText("Delete"));
    expect(onDelete).toHaveBeenCalledWith(lists[0]);
    expect(location()).toBe("/setlists");
    cleanup();

    renderList(false);
    expect(screen.queryByRole("button", { name: "More actions" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Perform" })).toHaveLength(2);
  });

  it("Edit from the menu opens the editor", async () => {
    renderList();
    await userEvent.click(screen.getAllByRole("button", { name: "More actions" })[0]);
    await userEvent.click(within(screen.getByRole("menu")).getByText("Edit"));
    expect(location()).toBe("/setlists/s1/edit");
  });
});
