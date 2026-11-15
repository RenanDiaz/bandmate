# Song metadata (Spotify, MusicBrainz, AcousticBrainz, Lyrics.ovh)

When a user clicks **Fetch Metadata** in the new-song form or the edit modal,
Bandmate fills in album, artwork, duration, key, tempo, lyrics and more from
several free APIs. Every field stays editable before saving, and the app works
without any of these services (fields are just entered by hand).

## How it works

`metadataService.getSongMetadata(title, artist?)` (`src/services/metadataService.ts`)
combines:

| Source | Service | Provides | Auth |
|--------|---------|----------|------|
| Spotify Web API (Client Credentials) | `spotifyService.ts` | title, artist, album, release date, artwork, Spotify URL, duration, popularity | `spotify-metadata` Edge Function (secrets `SPOTIFY_CLIENT_*`, signed-in user) |
| MusicBrainz | `musicBrainzService.ts` | fallback basic metadata, artist country, recording ID | none (User-Agent) |
| AcousticBrainz | `musicBrainzService.ts` | key, tempo, danceability, acousticness, genre, instrumental, mood | none |
| Lyrics.ovh | `lyricsService.ts` | lyrics | none |

Order:

1. Spotify for basic metadata (skipped if not configured or it fails).
2. MusicBrainz always — for the recording ID and as fallback for basic fields.
3. AcousticBrainz, with that recording ID, for audio features.
4. Lyrics.ovh once an artist name is known.

The result records `sources: { basic, audio, lyrics }`; the form logs them to the
console ("Metadata loaded from: Spotify + AcousticBrainz …"). It returns `null`
only when neither basic metadata nor audio features were found.

**Why not Spotify audio features?** Spotify's `/audio-features` endpoint needs
user OAuth in Development Mode (25 whitelisted users max), which would force
every user to log in to Spotify just to add a song. AcousticBrainz gives key and
tempo without that friction, at the cost of smaller coverage.

### AcousticBrainz is frozen

AcousticBrainz stopped accepting submissions and ended in **February 2022**. Its
API is still readable, but only recordings submitted before then have data, so
newer, obscure or local songs come back without key, tempo or genre (the console
logs `AcousticBrainz: No data available (404 Not Found)`) and are entered by hand.
To check a recording directly:
`https://acousticbrainz.org/api/v1/{recording-id}/low-level` (and `/high-level`).
Alternatives considered — Spotify with user OAuth, TheAudioDB, Last.fm, client-side
audio analysis — are not implemented.

## Spotify setup

> **Off in production (November 2026).** Spotify now requires the owner of a
> Development Mode app to have Spotify Premium; without it the token or
> search request fails and `spotify-metadata` answered 502 on every lookup.
> The secrets were removed, so the function answers `not-configured` at once
> and lookups use MusicBrainz only (no album artwork, Spotify link or
> popularity). To turn it back on, follow the steps below with an account
> that has Premium; no code change is needed.

1. At the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard),
   **Create app**: any name, redirect URI `http://localhost:5173` (required but
   unused), API **Web API**.
2. **Settings** → copy the **Client ID** and **Client Secret**.
3. Store them as Edge Function secrets and deploy the function:
   ```bash
   supabase secrets set SPOTIFY_CLIENT_ID=... SPOTIFY_CLIENT_SECRET=...
   supabase functions deploy spotify-metadata
   ```

The browser never sees the credentials: `spotifyService` calls the
`spotify-metadata` Edge Function (`supabase/functions/spotify-metadata`), which
does the Client Credentials exchange, caches the token and answers
`{ metadata }` for a signed-in user. Without the secrets it answers
`not-configured` and the lookup falls back to MusicBrainz. Nothing is set in
Vercel. (Until November 2026 the credentials were `VITE_SPOTIFY_CLIENT_*`
variables, inlined in the public bundle; rotate the old client secret if it
was ever deployed.)

The metadata columns on `songs` (album, release date, energy, …) come from
`supabase/migrations/20260117171019_add_song_metadata_fields.sql`; `country`
and `language` are older (in the baseline).

Country is stored as an ISO 3166-1 alpha-2 code (`MX`), language as an ISO
639-1 code (`es`); the app renders their names with `Intl.DisplayNames` in
the UI language (`src/lib/isoCodes.ts`). The lookup fills Country from
MusicBrainz's artist country, which is already a code; a non-standard one
(`XW` worldwide, `XE` Europe, historical `SU`) leaves the field as it was.
No service returns a song's language.

## Limits

- Spotify: ~180 requests/minute per app; the access token is cached for ~1 h.
- MusicBrainz: 1 request/second — a lookup takes 2–4 s in total.
- AcousticBrainz / Lyrics.ovh: no documented limits; coverage is best for
  popular songs.

Only the searched title and artist leave the app; nothing from the band is sent.
Artwork URLs point at Spotify's CDN (images are not copied).

## Troubleshooting

- **Song not found** — check spelling, add or correct the artist, confirm the
  song exists on Spotify/MusicBrainz, or enter it manually.
- **No key/tempo** — normal for songs missing from AcousticBrainz (see above).
- **Only MusicBrainz as source** — Spotify credentials are missing or wrong
  (the console warns `Spotify API credentials not configured`), or the rate
  limit was hit. `.env` changes need a dev-server restart.

## References

- [Spotify Web API](https://developer.spotify.com/documentation/web-api) ·
  [Client Credentials flow](https://developer.spotify.com/documentation/web-api/tutorials/client-credentials-flow)
- [MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API)
- [AcousticBrainz](https://acousticbrainz.org/data)
