import { describe, expect, it } from "vitest";
import {
  SPOTIFY_MAX_FIELD_LENGTH,
  parseSpotifyLookup,
  spotifySearchPath,
  trackToMetadata,
} from "../../../supabase/functions/_shared/spotifyMetadata";

describe("parseSpotifyLookup", () => {
  it("trims title and artist", () => {
    expect(parseSpotifyLookup({ title: "  Blackbird ", artist: " The Beatles " })).toEqual({
      title: "Blackbird",
      artist: "The Beatles",
    });
  });

  it("treats a missing or blank artist as none", () => {
    expect(parseSpotifyLookup({ title: "Blackbird" })).toEqual({ title: "Blackbird" });
    expect(parseSpotifyLookup({ title: "Blackbird", artist: "" })).toEqual({ title: "Blackbird" });
    expect(parseSpotifyLookup({ title: "Blackbird", artist: "   " })).toEqual({ title: "Blackbird" });
  });

  it.each([
    ["no body", null],
    ["no title", { artist: "x" }],
    ["blank title", { title: "   " }],
    ["title too long", { title: "x".repeat(SPOTIFY_MAX_FIELD_LENGTH + 1) }],
    ["non-string artist", { title: "x", artist: 3 }],
    ["artist too long", { title: "x", artist: "y".repeat(SPOTIFY_MAX_FIELD_LENGTH + 1) }],
  ])("refuses %s", (_label, body) => {
    expect(parseSpotifyLookup(body)).toBeNull();
  });
});

describe("spotifySearchPath", () => {
  it("uses field filters when there is an artist", () => {
    expect(spotifySearchPath({ title: "Blackbird", artist: "The Beatles" })).toBe(
      `/search?q=${encodeURIComponent("track:Blackbird artist:The Beatles")}&type=track&limit=1`
    );
  });

  it("searches the bare title otherwise, encoded", () => {
    expect(spotifySearchPath({ title: "Rock & Roll" })).toBe("/search?q=Rock%20%26%20Roll&type=track&limit=1");
  });
});

describe("trackToMetadata", () => {
  it("keeps the fields the app uses, duration in seconds", () => {
    expect(
      trackToMetadata({
        name: "Under Pressure",
        artists: [{ name: "Queen" }, { name: "David Bowie" }],
        album: { name: "Hot Space", release_date: "1982-05-21", images: [{ url: "https://img/1" }] },
        duration_ms: 248_440,
        popularity: 80,
        external_urls: { spotify: "https://open.spotify.com/track/1" },
      })
    ).toEqual({
      title: "Under Pressure",
      artist: "Queen, David Bowie",
      album: "Hot Space",
      albumArt: "https://img/1",
      releaseDate: "1982-05-21",
      spotifyUrl: "https://open.spotify.com/track/1",
      duration: 248,
      popularity: 80,
    });
  });
});
