import { beforeEach, describe, expect, it, vi } from "vitest";

// A minimal Supabase stub: `select().eq().single()` reads the source;
// `insert().select().single()` returns what was inserted with a new id.
const inserted: Record<string, unknown>[] = [];
let sourceRow: Record<string, unknown> = {};

vi.mock("../../lib/supabaseClient", () => ({
  supabase: {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "u2" } } })) },
    from: vi.fn(() => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: sourceRow, error: null }) }) }),
      insert: (rows: Record<string, unknown>[]) => {
        inserted.push(rows[0]);
        return { select: () => ({ single: async () => ({ data: { ...rows[0], id: "copy-1" }, error: null }) }) };
      },
    })),
  },
}));
vi.mock("../../lib/authSession", () => ({ getSessionUser: vi.fn(async () => ({ id: "u2" })) }));

const { duplicateSetlist } = await import("../setlistsService");

beforeEach(() => {
  inserted.length = 0;
  sourceRow = {
    id: "src-1",
    band_id: 7,
    user_id: "u1",
    name: "Friday",
    description: "Bar gig",
    is_draft: false,
    target_minutes: 60,
    youtube_playlist_url: "https://music.youtube.com/playlist?list=x",
    songs: [
      { type: "section", id: "sec-1", label: "Set 1", position: 0 },
      { type: "song", song_id: "a", notes: "capo 2", position: 1 },
      { type: "break", id: "brk-1", label: "Break", duration: 15, position: 2 },
    ],
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z",
  };
});

describe("duplicateSetlist", () => {
  it("creates a non-draft copy in the same band with the items, notes, description and target (AC9–AC10)", async () => {
    const copy = await duplicateSetlist("src-1", "Friday (copy)");

    expect(copy.id).toBe("copy-1");
    expect(inserted).toHaveLength(1);
    const row = inserted[0];
    expect(row).toMatchObject({
      band_id: 7,
      name: "Friday (copy)",
      description: "Bar gig",
      target_minutes: 60,
      is_draft: false,
      user_id: "u2",
    });
    expect(row).not.toHaveProperty("youtube_playlist_url");
    expect(row).not.toHaveProperty("id");
    expect(row.songs).toMatchObject([
      { type: "section", label: "Set 1", position: 0 },
      { type: "song", song_id: "a", notes: "capo 2", position: 1 },
      { type: "break", label: "Break", duration: 15, position: 2 },
    ]);
  });

  it("gives the special items new ids", async () => {
    await duplicateSetlist("src-1", "Copy");
    const ids = (inserted[0].songs as { id?: string }[]).map((item) => item.id);
    expect(ids[0]).toBeTruthy();
    expect(ids[0]).not.toBe("sec-1");
    expect(ids[2]).not.toBe("brk-1");
  });

  it("lets the description be overridden and omits an absent target", async () => {
    sourceRow = { ...sourceRow, target_minutes: null };
    await duplicateSetlist("src-1", "Copy", { description: "New notes" });
    expect(inserted[0]).toMatchObject({ description: "New notes" });
    expect(inserted[0]).not.toHaveProperty("target_minutes");
  });
});
