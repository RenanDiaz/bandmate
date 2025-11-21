# AcousticBrainz Status & Data Availability

## Important Information

⚠️ **AcousticBrainz stopped accepting new submissions in 2022** and the project officially ended.

### What This Means

- ✅ **The API still works** - The data that was submitted before 2022 is still accessible
- ❌ **Limited coverage** - Only songs that were submitted to AcousticBrainz before 2022 have data
- ❌ **No new submissions** - You cannot add new songs to the database
- ❌ **Coverage gaps** - Many songs, especially newer releases, will not have audio features

### Current Implementation

Our hybrid metadata service now extracts the following from AcousticBrainz when available:

**Musical Properties:**
- ✅ Key (e.g., "C minor", "G major")
- ✅ Tempo (BPM)

**Audio Characteristics:**
- ✅ Danceability (0.0-1.0)
- ✅ Acousticness (0.0-1.0)

**Genre & Classification:**
- ✅ Genre (Rock, Pop, Jazz, Classical, Dance, Hip Hop, R&B, Speech)
- ✅ Instrumental vs. Vocal classification

**Mood/Emotion:**
- ✅ Happy score (0.0-1.0)
- ✅ Sad score (0.0-1.0)
- ✅ Aggressive score (0.0-1.0)

### Testing

To see if a song has AcousticBrainz data:

1. Get the MusicBrainz Recording ID
2. Check: `https://acousticbrainz.org/api/v1/{recording-id}/low-level`
3. Check: `https://acousticbrainz.org/api/v1/{recording-id}/high-level`

**Example (this works):**
- Recording ID: `1844ff2e-9d6b-4897-9597-69cc945d32ea`
- https://acousticbrainz.org/api/v1/1844ff2e-9d6b-4897-9597-69cc945d32ea/low-level
- https://acousticbrainz.org/api/v1/1844ff2e-9d6b-4897-9597-69cc945d32ea/high-level

### Expected Behavior

When you click "Fetch Metadata":

**Scenario 1: Song has AcousticBrainz data (pre-2022)**
```
✅ All fields filled:
- Key: "C minor"
- Tempo: 120 BPM
- Genre: "Rock"
- Danceability: 0.65
- Mood: { happy: 0.13, sad: 0.07, aggressive: 0.45 }
- Is Instrumental: false
```

**Scenario 2: Song has NO AcousticBrainz data**
```
⚠️  Console shows:
"AcousticBrainz: No data available (404 Not Found)"
"💡 Tip: Not all songs have AcousticBrainz data. Try a different song or enter values manually."

✅ Spotify data still works:
- Artist, album, artwork, Spotify URL ✅
- Key, tempo, genre: ❌ (you must enter manually)
```

### Why Key Field Might Not Be Filled

1. **Song not in AcousticBrainz** (most common)
   - Song was released after 2022
   - Song was never submitted to AcousticBrainz
   - Song is obscure or from a local artist

2. **Song in AcousticBrainz but no audio features**
   - Low-level or high-level analysis failed
   - Incomplete data submission

3. **Technical issues**
   - API temporarily down
   - Network error
   - MusicBrainz Recording ID not found

### Debugging

Check the browser console (F12) when fetching metadata. You should see:

```
🔍 Fetching metadata for: "Song Title" by Artist
✅ Spotify basic metadata retrieved
🔍 MusicBrainz API Request: https://musicbrainz.org/ws/2/recording/...
✅ MusicBrainz metadata found: {...}
🔍 AcousticBrainz API Request: https://acousticbrainz.org/api/v1/.../low-level
ℹ️  Note: AcousticBrainz stopped accepting submissions in 2022. Limited data available.

Either:
✅ Key found: "C minor"
✅ Tempo found: 120

Or:
⚠️  AcousticBrainz: No data available (404 Not Found)
💡 Tip: Not all songs have AcousticBrainz data...
```

### Alternatives (Future Consideration)

Since AcousticBrainz has limited coverage, consider:

1. **Manual Entry** (current solution)
   - All fields can be entered manually
   - Most reliable for any song

2. **Spotify with OAuth** (requires user login)
   - Requires implementing full OAuth flow
   - Requires users to log in with Spotify
   - Development Mode: 25 user limit
   - Extended Quota Mode: Requires approval

3. **TheAudioDB API**
   - Free tier available
   - Basic metadata, no audio features

4. **Last.fm API**
   - Tags and similar artists
   - No audio features (key, tempo)

5. **Custom Audio Analysis**
   - Use Web Audio API for client-side analysis
   - Requires users to upload/play audio
   - Complex implementation

### Recommendation

For now, continue using the hybrid approach:

- ✅ **Spotify** → Basic metadata (always works)
- ✅ **MusicBrainz** → Fallback metadata (always works)
- ⚠️ **AcousticBrainz** → Audio features (works for pre-2022 songs)
- ✅ **Manual Entry** → Always available as fallback

This gives the best coverage with minimal user friction.

---

**Last Updated**: 2025-11-20
**AcousticBrainz Project End Date**: February 2022
**API Status**: Still accessible but read-only
