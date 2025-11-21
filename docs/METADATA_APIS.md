# Metadata APIs Integration

This document explains how Bandmate fetches song metadata using multiple free APIs without requiring user authentication.

## Overview

Bandmate uses a **hybrid approach** combining multiple APIs to provide comprehensive song metadata:

- **Spotify Web API** - Basic metadata (artist, album, artwork, Spotify links)
- **MusicBrainz API** - Open music database (fallback for basic metadata)
- **AcousticBrainz API** - Audio features (key, tempo, danceability)

## Why Multiple APIs?

### The Spotify API Problem

Spotify's Audio Features endpoint (`/audio-features/{id}`) requires **user authentication** when your app is in Development Mode. This means:

- ❌ Users would need to log in with their Spotify account just to add songs
- ❌ Only 25 users can be whitelisted in Development Mode
- ❌ Adds unnecessary friction to the song creation flow

### The Solution

By combining multiple free APIs, we get:

- ✅ No user authentication required
- ✅ Comprehensive metadata from multiple sources
- ✅ Graceful fallbacks if one API fails
- ✅ Better data coverage (some songs are on MusicBrainz but not Spotify)

## API Details

### 1. Spotify Web API (Client Credentials Flow)

**What we get:**
- ✅ Artist name
- ✅ Album name and release date
- ✅ Album artwork (high quality)
- ✅ Spotify URL (direct link to song)
- ✅ Duration

**What we DON'T get:**
- ❌ Audio features (key, tempo, energy) - requires user auth

**Rate Limits:**
- 180 requests per minute
- No daily limit

**Setup:**
1. Create app at https://developer.spotify.com/dashboard
2. Get Client ID and Client Secret
3. Add to `.env`:
   ```env
   VITE_SPOTIFY_CLIENT_ID=your_client_id
   VITE_SPOTIFY_CLIENT_SECRET=your_client_secret
   ```

**Code:**
```typescript
import { spotifyService } from './services/spotifyService';

const metadata = await spotifyService.getSongMetadata('Bohemian Rhapsody', 'Queen');
// Returns: artist, album, albumArt, releaseDate, spotifyUrl, duration
```

### 2. MusicBrainz API

**What we get:**
- ✅ Artist name
- ✅ Album name and release date
- ✅ Recording ID (for AcousticBrainz lookup)
- ✅ Duration

**Rate Limits:**
- 1 request per second
- No authentication required

**No Setup Required:**
- Completely free and open
- Just requires a User-Agent header

**Code:**
```typescript
import { musicBrainzService } from './services/musicBrainzService';

const { metadata, audioFeatures } = await musicBrainzService.getSongData(
  'Bohemian Rhapsody',
  'Queen'
);
```

### 3. AcousticBrainz API

**What we get:**
- ✅ Key (e.g., "C", "D minor")
- ✅ Tempo (BPM)
- ✅ Danceability (0.0-1.0)
- ✅ Acousticness (0.0-1.0)

**Rate Limits:**
- No documented limits
- No authentication required

**Coverage:**
- Good for popular songs
- Smaller database than Spotify
- Community-contributed data

**Code:**
```typescript
import { musicBrainzService } from './services/musicBrainzService';

// Need MusicBrainz recording ID first
const features = await musicBrainzService.getAudioFeatures(musicbrainzId);
// Returns: key, tempo, danceability, acousticness
```

## Unified Metadata Service

The **metadataService** automatically combines all APIs for you:

```typescript
import { metadataService } from './services/metadataService';

const metadata = await metadataService.getSongMetadata('Bohemian Rhapsody', 'Queen');

// Returns combined data from all sources:
// {
//   title: "Bohemian Rhapsody",
//   artist: "Queen",
//   album: "A Night at the Opera",
//   albumArt: "https://...",  // from Spotify
//   releaseDate: "1975-10-31",
//   spotifyUrl: "https://open.spotify.com/track/...",
//   duration: 354,
//   key: "Bb",                // from AcousticBrainz
//   tempo: 72,                // from AcousticBrainz
//   danceability: 0.45,       // from AcousticBrainz
//   acousticness: 0.73,       // from AcousticBrainz
//   sources: {
//     basic: 'spotify',       // which API provided basic metadata
//     audio: 'acousticbrainz' // which API provided audio features
//   }
// }
```

### Fallback Logic

1. **Try Spotify first** for basic metadata (artist, album, artwork)
2. **Always query MusicBrainz** to get recording ID
3. **Use AcousticBrainz** with recording ID to get audio features
4. **Fallback to MusicBrainz** for basic metadata if Spotify fails

## User Experience

### In the UI

When a user clicks **"Fetch Metadata"**:

1. ⏳ Shows loading spinner: "Fetching metadata..."
2. 🔍 Queries Spotify + MusicBrainz + AcousticBrainz in sequence
3. ✅ Auto-fills all available fields
4. 📊 Console logs which sources were used
5. ✏️ User can edit any field before saving

### Success Message

```
✅ Metadata loaded from: Spotify + AcousticBrainz
```

Or if Spotify is unavailable:

```
✅ Metadata loaded from: MusicBrainz + AcousticBrainz
```

## Comparison with Spotify-Only Approach

| Feature | Spotify Only (with OAuth) | Hybrid Approach (Current) |
|---------|---------------------------|---------------------------|
| User Auth Required | ✅ Yes (OAuth login) | ❌ No |
| Setup Complexity | 🔴 High | 🟢 Low |
| Development Mode Limit | 🔴 25 users max | 🟢 Unlimited |
| Album Artwork | ✅ Yes | ✅ Yes (from Spotify) |
| Spotify Links | ✅ Yes | ✅ Yes (from Spotify) |
| Audio Features | ✅ Yes | ✅ Yes (from AcousticBrainz) |
| Coverage | 🟡 Spotify catalog only | 🟢 Spotify + MusicBrainz |
| User Friction | 🔴 Must log in | 🟢 No login needed |

## Future: Full Spotify OAuth (Optional)

If you later want to implement full Spotify user authentication for additional features:

1. The current code is preserved (commented out)
2. You can switch to Authorization Code Flow
3. This would enable:
   - Personal playlists import
   - Spotify playback controls
   - More detailed audio analysis

## Troubleshooting

### "Song not found"

**Try:**
1. Check spelling of title and artist
2. Try with just the title (omit artist)
3. Search on Spotify/MusicBrainz first to verify the song exists
4. Enter metadata manually if song is very obscure

### Missing audio features (key, tempo)

**This is normal if:**
- Song is not in AcousticBrainz database
- Song is very new or very obscure
- You can manually enter these values

### Slow metadata fetching

**This is expected:**
- MusicBrainz rate limit: 1 request per second
- We query 2-3 APIs in sequence
- Total time: 2-4 seconds typical

## API Documentation Links

- [Spotify Web API](https://developer.spotify.com/documentation/web-api)
- [MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API)
- [AcousticBrainz API](https://acousticbrainz.org/data)

## Source Code

- **Spotify Service**: `src/services/spotifyService.ts`
- **MusicBrainz Service**: `src/services/musicBrainzService.ts`
- **Unified Service**: `src/services/metadataService.ts`
- **UI Component**: `src/components/NewSongForm.tsx`

---

**Last Updated**: 2025-11-20
**Status**: ✅ Implemented and Working
