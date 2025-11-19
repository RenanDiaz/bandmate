# Spotify API Setup Guide

This guide will walk you through setting up Spotify API integration for automatic song metadata enrichment in Bandmate.

## What You'll Get

With Spotify API integration, Bandmate can automatically fetch:
- **Basic Info**: Artist name, album name, release date, album artwork
- **Musical Properties**: Key, tempo (BPM), time signature, duration
- **Audio Features**: Energy, danceability, acousticness, instrumentalness
- **Spotify Link**: Direct link to the song on Spotify

## Prerequisites

- A Spotify account (free or premium)
- Access to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)

## Setup Steps

### 1. Create a Spotify Developer Account

1. Go to https://developer.spotify.com/dashboard
2. Log in with your Spotify account
3. Accept the Spotify Developer Terms of Service

### 2. Create an App

1. Click **"Create app"** button
2. Fill in the app details:
   - **App name**: `Bandmate` (or any name you prefer)
   - **App description**: `Band management app with song metadata enrichment`
   - **Website**: Leave blank or use `http://localhost:5173` for development
   - **Redirect URI**: `http://localhost:5173` (not used, but required)
   - **API/SDK**: Check **Web API**
3. Click **"Save"**

### 3. Get Your Credentials

1. After creating the app, you'll see your app's dashboard
2. Click **"Settings"** button in the top right
3. You'll see two important values:
   - **Client ID** - visible directly
   - **Client Secret** - click **"View client secret"** to reveal it
4. **IMPORTANT**: Keep your Client Secret private! Never commit it to Git.

### 4. Configure Environment Variables

1. In your Bandmate project root, create or edit the `.env` file:

```env
# Existing Supabase config
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key

# Add Spotify API credentials
VITE_SPOTIFY_CLIENT_ID=your_client_id_here
VITE_SPOTIFY_CLIENT_SECRET=your_client_secret_here
```

2. Replace `your_client_id_here` and `your_client_secret_here` with the values from step 3

3. **Security Note**: The `.env` file is already in `.gitignore`, but double-check it's not tracked by Git:

```bash
git status
# .env should NOT appear in the list
```

### 5. Apply Database Migration

Run the migration to add new metadata fields to your songs table:

```bash
# If using Supabase CLI locally
supabase migration up

# Or apply manually in Supabase Dashboard:
# 1. Go to SQL Editor in your Supabase dashboard
# 2. Copy the contents of supabase/migrations/add_song_metadata_fields.sql
# 3. Paste and run the SQL
```

### 6. Restart Development Server

```bash
# Stop the current dev server (Ctrl+C)
# Start it again
npm run dev
```

## Usage

### Fetching Metadata

1. Create a new song in Bandmate
2. Enter the **Song Title** (required)
3. Optionally enter the **Artist name** for more accurate results
4. Click **"Fetch Metadata from Spotify"** button
5. Bandmate will automatically fill in:
   - Artist (if not already entered)
   - Album
   - Key (e.g., "C", "D minor")
   - Tempo (BPM)
   - Duration (seconds)
   - Time signature (4/4, 3/4, etc.)
   - Energy and danceability scores
6. Review and edit any fields as needed
7. Click **"Save Song"**

### Tips for Best Results

- **Be specific**: Use the official song title and artist name
- **Check spelling**: Typos will prevent finding the song
- **Add artist name**: Including the artist improves search accuracy
- **Popular songs work best**: Spotify has better metadata for well-known tracks
- **Manual override**: All fields can be edited manually if Spotify data is wrong

## Troubleshooting

### "Song not found on Spotify"

**Possible causes**:
- Song title or artist name is misspelled
- Song is not available on Spotify (rare or local artist)
- Song has a different official title on Spotify

**Solutions**:
1. Check spelling and try again
2. Add or correct the artist name
3. Search on Spotify web/app first to find the exact title
4. Enter metadata manually if song isn't on Spotify

### "Failed to fetch metadata"

**Possible causes**:
- Invalid API credentials
- Rate limit exceeded (180 requests/minute)
- Network connectivity issues

**Solutions**:
1. Verify your Client ID and Client Secret in `.env`
2. Restart the development server
3. Wait a few minutes if you've made many requests
4. Check browser console for detailed error messages

### Metadata button doesn't appear

**Possible causes**:
- Spotify credentials not configured
- Environment variables not loaded

**Solutions**:
1. Verify `.env` file exists with both `VITE_SPOTIFY_CLIENT_ID` and `VITE_SPOTIFY_CLIENT_SECRET`
2. Restart the development server (changes to `.env` require restart)
3. Check browser console for configuration warnings

## API Rate Limits

**Spotify Web API Free Tier**:
- **180 requests per minute** per application
- **No daily limit** for Client Credentials flow

**Best practices**:
- Bandmate caches access tokens for ~1 hour
- Each metadata fetch makes 2 API calls (search + audio features)
- ~90 songs can be looked up per minute
- Rate limits are per app, shared across all users (development only)

**In production**: Consider implementing server-side caching to reduce API calls.

## Privacy & Data

**What data is shared with Spotify**:
- Song titles and artist names you search for
- API requests are logged by Spotify (standard practice)

**What data is NOT shared**:
- Your band information
- Lyrics and chords you enter
- Your Supabase data
- Any user authentication information

**Data storage**:
- Metadata fetched from Spotify is stored in your Supabase database
- Album artwork URLs point to Spotify CDN (images not stored locally)
- Spotify URLs allow users to open songs directly in Spotify

## Alternative: Manual Entry

If you prefer not to use Spotify API, you can:
1. Skip the API setup entirely
2. Enter all song metadata manually
3. The "Fetch Metadata" button simply won't appear
4. All features work normally, just without auto-fill

## Production Deployment

When deploying Bandmate to production:

### Environment Variables

Add your Spotify credentials to your hosting platform:

**Vercel**:
```bash
vercel env add VITE_SPOTIFY_CLIENT_ID
vercel env add VITE_SPOTIFY_CLIENT_SECRET
```

**Netlify**:
1. Go to Site settings > Environment variables
2. Add `VITE_SPOTIFY_CLIENT_ID` and `VITE_SPOTIFY_CLIENT_SECRET`

**Other platforms**: Consult your hosting provider's documentation

### Update Redirect URIs (if needed)

1. Go to your Spotify app settings
2. Add production domain to Redirect URIs
3. Example: `https://bandmate.yourdomain.com`
4. Note: Not needed for Client Credentials flow, but good practice

### Rate Limit Considerations

For production with multiple users:
- Consider implementing server-side caching
- Cache Spotify metadata in your database
- Add rate limiting per user if needed
- Monitor Spotify API usage in developer dashboard

## Advanced: MusicBrainz Fallback (Future)

If Spotify API is not configured or a song isn't found, Bandmate could fall back to MusicBrainz API:
- Completely free and open
- No API key required
- Covers more obscure artists
- Less comprehensive audio features

See [API_RESEARCH.md](API_RESEARCH.md) for implementation details.

## Resources

- [Spotify Web API Documentation](https://developer.spotify.com/documentation/web-api)
- [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
- [Client Credentials Flow Guide](https://developer.spotify.com/documentation/web-api/tutorials/client-credentials-flow)
- [Audio Features Reference](https://developer.spotify.com/documentation/web-api/reference/get-audio-features)

## Support

For issues with:
- **Bandmate integration**: Open an issue on GitHub
- **Spotify API**: Check [Spotify Developer Community](https://community.spotify.com/t5/Spotify-for-Developers/bd-p/Spotify_Developer)

---

**Last Updated**: 2025-11-19
**Bandmate Version**: Phase 3 (Songs Enhancement)
