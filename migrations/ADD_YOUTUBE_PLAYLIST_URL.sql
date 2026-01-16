-- Add youtube_playlist_url column to setlists table
-- This stores the URL of the YouTube Music playlist created from this setlist

ALTER TABLE setlists
ADD COLUMN IF NOT EXISTS youtube_playlist_url TEXT;

-- Add a comment explaining the column
COMMENT ON COLUMN setlists.youtube_playlist_url IS 'URL of the YouTube Music playlist exported from this setlist';
