# API Research for Bandmate

> **Research note (Nov 2025), not a description of the app.** Of what it
> recommends, Spotify and MusicBrainz shipped — see
> [../guides/song-metadata.md](../guides/song-metadata.md). Setlist.fm,
> Songstats and the other APIs below are **not** integrated.

This document evaluates external APIs that could enhance Bandmate's functionality.

## Table of Contents

- [Setlist.fm API](#setlistfm-api) ⭐ **Recommended**
- [Songstats API](#songstats-api)
- [Other Potential APIs](#other-potential-apis)

---

## Setlist.fm API

**Status**: ⭐ **Highly Recommended for Bandmate**

### Overview

Setlist.fm is a community-driven database of concert setlists with a free API for non-commercial projects. This is an **excellent fit** for Bandmate's core use case.

### API Details

**Base URL**: `https://api.setlist.fm/rest/1.0/`
**Documentation**: https://api.setlist.fm/docs/1.0/index.html
**Version**: 1.0 (active)

### Authentication

- Requires API key via `x-api-key` HTTP header
- Register at setlist.fm to obtain key
- Free for non-commercial projects

### Available Endpoints

#### Artist Endpoints
- `GET /artist/{mbid}` - Get artist details by MusicBrainz ID
- `GET /artist/{mbid}/setlists` - Get setlists for an artist
- `GET /search/artists` - Search for artists

#### Setlist Endpoints
- `GET /setlist/{setlistId}` - Get specific setlist details
- `GET /setlist/version/{versionId}` - Get specific version of a setlist
- `GET /search/setlists` - Search setlists (with filters: artist, year, etc.)

#### Venue & Location Endpoints
- `GET /venue/{venueId}` - Get venue details
- `GET /venue/{venueId}/setlists` - Get setlists performed at a venue
- `GET /search/venues` - Search for venues
- `GET /city/{geoId}` - Get city information
- `GET /search/cities` - Search for cities
- `GET /search/countries` - Search for countries

#### User Endpoints
- `GET /user/{userId}` - Get user profile
- `GET /user/{userId}/attended` - Get setlists user attended
- `GET /user/{userId}/edited` - Get setlists user edited

### Response Formats

- Default: XML
- JSON: Set `Accept: application/json` header
- Localization: Use `Accept-Language` header (en, es, fr, de, pt, tr, it, pl)

### Data Structure

**Setlist Object**:
```json
{
  "id": "string",
  "versionId": "string",
  "eventDate": "dd-MM-yyyy",
  "artist": {
    "mbid": "uuid",
    "name": "string",
    "sortName": "string"
  },
  "venue": {
    "id": "string",
    "name": "string",
    "city": {
      "id": "string",
      "name": "string",
      "country": { "code": "string", "name": "string" }
    }
  },
  "sets": {
    "set": [
      {
        "song": [
          {
            "name": "string",
            "cover": { "name": "artist name" }
          }
        ]
      }
    ]
  }
}
```

### Key Features

1. **Setlist Discovery** - Browse what songs bands typically play live
2. **Song Inspiration** - Find popular songs by genre/artist for covers
3. **Venue Data** - Get details about venues for show management
4. **Historical Data** - See what songs work well together in setlists
5. **Community Data** - Access millions of real-world setlists

### Pricing & Terms

- ✅ **Free** for non-commercial projects
- ❌ Commercial use requires contacting setlist.fm
- Rate limits: Not documented (use responsibly)

### Use Cases for Bandmate

#### Phase 4: Setlists Enhancement
1. **Setlist Inspiration**
   - "Show me typical setlists for [genre] bands"
   - Import successful setlist templates from similar artists

2. **Song Order Optimization**
   - Analyze common song ordering patterns
   - Suggest song flow based on energy/tempo

3. **Cover Song Discovery**
   - Find popular cover songs in specific genres
   - See which covers work well together

#### Phase 5: Shows Management
1. **Venue Information**
   - Auto-populate venue details when creating shows
   - See historical setlists at specific venues

2. **Show Planning**
   - Compare your planned setlist to what other bands played at the same venue
   - Adjust for venue size, audience, etc.

#### Future Features
1. **Setlist Sharing**
   - Export Bandmate setlists to setlist.fm format
   - Build band's performance history

2. **Trend Analysis**
   - "What songs are trending in [city/genre]?"
   - Regional preferences for covers

### Implementation Considerations

**Pros**:
- ✅ Perfect domain fit (setlists are core to both platforms)
- ✅ Free for Bandmate's use case
- ✅ Rich historical data from real performances
- ✅ Well-documented REST API
- ✅ Multiple language support
- ✅ Venue database included

**Cons**:
- ⚠️ Requires MusicBrainz IDs for artists (extra lookup step)
- ⚠️ No explicit rate limits documented (must implement own throttling)
- ⚠️ Community data quality varies (user-submitted content)
- ⚠️ Some venues may lack city/location data

### Integration Strategy

**Phase 1: Basic Integration** (Phase 4)
```typescript
// src/services/setlistFmService.ts
export const searchSetlists = async (artistName: string, year?: number) => {
  // Search setlists by artist and optional year
}

export const getSetlistDetails = async (setlistId: string) => {
  // Get full setlist with songs
}
```

**Phase 2: Enhanced Features** (Phase 5)
```typescript
export const searchVenues = async (cityName: string) => {
  // Find venues by location
}

export const getVenueSetlists = async (venueId: string) => {
  // Get historical setlists at venue
}
```

**Phase 3: Advanced Integration** (Future)
```typescript
export const suggestSetlistOrder = (songs: Song[]) => {
  // Analyze setlist.fm data to suggest optimal song order
}

export const discoverCoverSongs = (genre: string, limit: number) => {
  // Find popular covers in genre
}
```

### Sample API Calls

**Search for artist setlists**:
```bash
curl -X GET "https://api.setlist.fm/rest/1.0/search/setlists?artistName=Radiohead&p=1" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Accept: application/json"
```

**Get specific setlist**:
```bash
curl -X GET "https://api.setlist.fm/rest/1.0/setlist/63de4613" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Accept: application/json"
```

**Search venues**:
```bash
curl -X GET "https://api.setlist.fm/rest/1.0/search/venues?name=Madison%20Square%20Garden" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Accept: application/json"
```

### Recommended Implementation Timeline

- **Phase 4 (Setlists Module)**: Core integration
  - Setlist search and import
  - Cover song discovery

- **Phase 5 (Shows Management)**: Venue integration
  - Venue search and auto-fill
  - Historical setlist analysis

- **Phase 7 (Polish)**: Advanced features
  - Setlist optimization suggestions
  - Trend analysis dashboards

---

## Songstats API

**Status**: ❌ **Not Recommended** (at this time)

### Overview

Songstats provides enterprise-grade music analytics across 18+ streaming and social platforms. While powerful, it's overkill for Bandmate's current needs.

### API Details

**Base URL**: Not publicly documented (enterprise access)
**Documentation**: https://docs.songstats.com/ (requires enterprise account)
**Access**: Enterprise/B2B only

### Supported Platforms

**Streaming**: Spotify, Apple Music, Amazon Music, Deezer, Tidal, SoundCloud, iTunes
**Social**: Instagram, TikTok, YouTube, Facebook, Twitter
**Discovery**: Shazam
**DJ/Electronic**: Beatport, Traxsource, 1001Tracklists
**Live Events**: Bandsintown, Songkick

### Key Features

1. **Cross-Platform Analytics** - Unified data from 18+ services
2. **Streaming Stats** - Track performance across DSPs
3. **Playlist Tracking** - Monitor playlist placements and editorial features
4. **Social Metrics** - Instagram, TikTok, YouTube engagement
5. **Radio Monitoring** - Radiostats API for radio play tracking
6. **Concert Data** - Events endpoint with show details (added April 2025)
7. **Geographic Data** - Country-level audience insights
8. **Historical Data** - Track performance over time

### Recent Updates (2025)

**April 2025**:
- New events endpoint for concert data
- Apple Music Editorial Features tracking

**February 2025**:
- Playlistcheck API added
- Radio play timestamps and station management
- Country data for Instagram/TikTok

### Pricing & Terms

- ❌ **Enterprise pricing** (likely $$$)
- ❌ No free tier documented
- ❌ Designed for labels, managers, and professional artists
- ⚠️ May require artist verification or label credentials

### Potential Use Cases for Bandmate

**If pricing were accessible** (it's not):
1. Auto-populate song metadata (key, tempo, genre)
2. Show original song performance for bands with releases
3. Discover trending songs in specific genres
4. Track band's social media growth
5. Concert data integration

### Why Not Recommended

**For Current Bandmate Scope**:
1. **Cost Prohibitive** - Enterprise B2B pricing model
2. **Feature Mismatch** - Built for tracking commercial releases, not local band management
3. **Target Audience Mismatch** - Professional artists/labels vs. local/semi-pro bands
4. **Complexity** - Overkill for managing setlists and rehearsals
5. **Better Alternatives Exist** - Free APIs provide similar basic metadata

### Better Alternatives for Current Needs

For the features Bandmate actually needs right now:

**Song Metadata**:
- **MusicBrainz API** - Free, open music database
- **Spotify Web API** - Free tier for search and metadata
- **Last.fm API** - Free for non-commercial use

**Event/Show Data**:
- **Bandsintown API** - Free tier available
- **Setlist.fm API** - Free for non-commercial (covers setlists AND venues)

**Lyrics & Chords**:
- **Ultimate Guitar API** (unofficial) - Chord charts
- **Genius API** - Lyrics with free tier
- **ChordPro format** - Open standard for chord notation

### Future Consideration

**Only consider Songstats if**:
- Bandmate pivots to serve professional artists with commercial releases
- You add a "performance analytics" premium tier
- Funding allows for enterprise API costs
- Feature set expands to social media tracking and streaming analytics

**Estimated Timeline**: Phase 8+ (post-MVP), only if business model supports it

---

## Other Potential APIs

### Music Metadata & Discovery

#### MusicBrainz API
**Status**: ✅ Recommended for Phase 3
**Cost**: Free (open database)
**Use Case**: Song metadata (artist, album, year, genre)
**Docs**: https://musicbrainz.org/doc/MusicBrainz_API

#### Spotify Web API
**Status**: ✅ Recommended for Phase 3
**Cost**: Free tier available
**Use Case**: Song search, metadata, audio features (key, tempo, energy)
**Docs**: https://developer.spotify.com/documentation/web-api

**Sample Features**:
- Search for tracks, artists, albums
- Get audio features (key, tempo, danceability, energy)
- Get artist genres and popularity
- Free tier: 180 requests per minute per app

#### Last.fm API
**Status**: ✅ Consider for Phase 7
**Cost**: Free for non-commercial
**Use Case**: Song tags, similar artists, popularity data
**Docs**: https://www.last.fm/api

### Lyrics & Chords

#### Genius API
**Status**: ✅ Consider for Phase 3
**Cost**: Free tier (500 requests/day)
**Use Case**: Lyrics, song annotations
**Docs**: https://docs.genius.com/

#### ChordPro Format
**Status**: ✅ Recommended for Phase 3
**Cost**: Free (open standard)
**Use Case**: Standardized chord notation format
**Docs**: https://www.chordpro.org/

### Events & Shows

#### Bandsintown API
**Status**: ✅ Consider for Phase 5
**Cost**: Free tier available
**Use Case**: Concert data, venue information, artist tour dates
**Docs**: https://www.bandsintown.com/api/overview

**Sample Features**:
- Search for artist events
- Get venue details
- Track RSVPs and attendance
- Artist recommendations

#### Songkick API
**Status**: ⚠️ API discontinued (2019)
**Alternative**: Use Bandsintown or Setlist.fm instead

### Sheet Music & Scores

#### MuseScore API
**Status**: ✅ Consider for Phase 6
**Cost**: Unknown (community platform)
**Use Case**: Sheet music, scores, tablature
**Docs**: https://musescore.org/

**Note**: MuseScore is primarily a desktop app with community sharing. No official public API documented, but has RSS feeds and web scraping possibilities.

---

## Recommended Integration Roadmap

### Phase 3: Songs Module Enhancement
1. **MusicBrainz API** - Song metadata foundation
2. **Spotify Web API** - Audio features (key, tempo)
3. **Genius API** - Lyrics lookup (optional)

### Phase 4: Setlists
1. **⭐ Setlist.fm API** - Core integration for setlist inspiration

### Phase 5: Shows Management
1. **⭐ Setlist.fm API** - Venue data (already integrated)
2. **Bandsintown API** - Concert data enrichment (optional)

### Phase 7: Polish
1. **Last.fm API** - Song recommendations and trends
2. Enhanced setlist.fm integration with ML-based suggestions

### Phase 8+: Future Considerations
1. **Songstats API** - Only if business model supports enterprise pricing

---

## Implementation Best Practices

### API Key Management
```typescript
// .env.local
VITE_SETLISTFM_API_KEY=your_key_here
VITE_SPOTIFY_CLIENT_ID=your_client_id
VITE_SPOTIFY_CLIENT_SECRET=your_secret

// src/config/api.ts
export const API_KEYS = {
  setlistFm: import.meta.env.VITE_SETLISTFM_API_KEY,
  spotify: {
    clientId: import.meta.env.VITE_SPOTIFY_CLIENT_ID,
    clientSecret: import.meta.env.VITE_SPOTIFY_CLIENT_SECRET,
  },
}
```

### Rate Limiting
```typescript
// src/lib/rateLimiter.ts
export class RateLimiter {
  private requests: number[] = []

  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}

  async throttle(): Promise<void> {
    const now = Date.now()
    this.requests = this.requests.filter(time => now - time < this.windowMs)

    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0]
      const waitTime = this.windowMs - (now - oldestRequest)
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }

    this.requests.push(Date.now())
  }
}

// Usage
const setlistFmLimiter = new RateLimiter(60, 60000) // 60 requests per minute
```

### Error Handling
```typescript
// src/services/apiClient.ts
export class ApiClient {
  async fetch<T>(url: string, options: RequestInit): Promise<T> {
    try {
      const response = await fetch(url, options)

      if (!response.ok) {
        if (response.status === 429) {
          throw new RateLimitError('Rate limit exceeded')
        }
        if (response.status === 401) {
          throw new AuthError('Invalid API key')
        }
        throw new ApiError(`API error: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new NetworkError('Network request failed')
    }
  }
}
```

### Caching Strategy
```typescript
// src/lib/apiCache.ts
export class ApiCache {
  private cache = new Map<string, { data: any; timestamp: number }>()

  constructor(private ttlMs: number = 5 * 60 * 1000) {} // 5 minutes default

  get(key: string): any | null {
    const cached = this.cache.get(key)
    if (!cached) return null

    if (Date.now() - cached.timestamp > this.ttlMs) {
      this.cache.delete(key)
      return null
    }

    return cached.data
  }

  set(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() })
  }
}
```

---

## Conclusion

**Immediate Action Items**:
1. ✅ **Register for Setlist.fm API key** - Start with this in Phase 4
2. ✅ **Register for Spotify Web API** - Plan for Phase 3
3. ⏸️ **Skip Songstats for now** - Revisit only if business needs change

**Priority Ranking**:
1. 🥇 **Setlist.fm** - Perfect fit, free, immediate value
2. 🥈 **Spotify Web API** - Metadata enrichment, free tier
3. 🥉 **MusicBrainz** - Open data, good fallback
4. 📊 **Bandsintown** - Nice-to-have for shows
5. ❌ **Songstats** - Skip (too expensive, wrong audience)

For questions or updates to this research, please update this document.

---

**Last Updated**: 2025-11-19
**Researched By**: Claude Code
**Next Review**: Before starting Phase 3 (Songs Enhancement)
