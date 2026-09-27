// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import type { Song } from "../../services/songsService";
import { bandContext, renderApp } from "../../test/renderApp";
import { SongList } from "../SongList";

const song = { id: "s1", band_id: 7, user_id: "u", title: "Song A", artist: "Artist", chords: "C G" } as Song;

function renderList(canEdit: boolean) {
  const onPerform = vi.fn();
  renderApp(
    <SongList songs={[song]} onEdit={vi.fn()} onDelete={vi.fn()} onPerform={onPerform} canEdit={canEdit} />,
    { ctx: bandContext() }
  );
  return onPerform;
}

describe("SongList Perform action (song spec AC7)", () => {
  it("renders without edit rights and calls onPerform without expanding the card", () => {
    const onPerform = renderList(false);
    expect(document.querySelector(".actions-toggle")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Perform" }));

    expect(onPerform).toHaveBeenCalledWith(song);
    // The card's expand chevron still points down: the click did not expand it.
    expect(document.querySelector(".bi-chevron-down")).not.toBeNull();
    expect(document.querySelector(".bi-chevron-up")).toBeNull();
  });

  it("renders next to the actions menu for editors", () => {
    renderList(true);
    expect(screen.getByRole("button", { name: "Perform" })).toBeTruthy();
    expect(document.querySelector(".actions-toggle")).not.toBeNull();
  });
});

describe("SongList card details", () => {
  it("expands from a click anywhere on the card and from the details button", () => {
    renderList(true);
    expect(screen.queryByText("C G")).toBeNull();

    // Click on the card itself (the title), not on the chevron.
    fireEvent.click(screen.getByText("Song A"));
    expect(screen.getByText("C G")).toBeTruthy();
    expect(document.querySelector(".bi-chevron-up")).not.toBeNull();

    // Clicking inside the expanded content keeps it open.
    fireEvent.click(screen.getByText("C G"));
    expect(screen.getByText("C G")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Hide details/ }));
    expect(screen.queryByText("C G")).toBeNull();
    expect(document.querySelector(".bi-chevron-down")).not.toBeNull();
  });

  it("shows no details toggle when the song has no lyrics or chords", () => {
    renderApp(
      <SongList
        songs={[{ ...song, chords: undefined, lyrics: undefined }]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onPerform={vi.fn()}
        canEdit={false}
      />,
      { ctx: bandContext() }
    );
    expect(document.querySelector(".bi-chevron-down")).toBeNull();
    expect(screen.queryByRole("button", { name: /Details/ })).toBeNull();
  });
});
