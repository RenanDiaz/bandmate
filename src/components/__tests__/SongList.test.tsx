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
