import { useCallback, useEffect, useState } from "react";

interface BackingTrackInfo {
  fileName: string;
  fileSize: number;
  mimeType: string;
  lastModified: number;
}

interface StoredTrackMapping {
  [songId: string]: BackingTrackInfo;
}

const STORAGE_KEY = "bandmate_backing_tracks";

/**
 * Hook to manage local backing track files for songs.
 * Files are stored in memory (as blob URLs) and their metadata is persisted in localStorage.
 * This allows us to remember which songs had backing tracks loaded, though the user
 * will need to re-select the file if they refresh the page.
 */
export function useLocalBackingTracks(setlistId: string) {
  // Map of songId -> blob URL for currently loaded files
  const [trackUrls, setTrackUrls] = useState<Record<string, string>>({});

  // Map of songId -> file metadata (persisted to localStorage)
  const [trackInfo, setTrackInfo] = useState<StoredTrackMapping>({});

  // Load stored track info from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY}_${setlistId}`);
      if (stored) {
        setTrackInfo(JSON.parse(stored) as StoredTrackMapping);
      }
    } catch (error) {
      console.error("Error loading backing track info from localStorage:", String(error));
    }
  }, [setlistId]);

  // Save track info to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_${setlistId}`, JSON.stringify(trackInfo));
    } catch (error) {
      console.error("Error saving backing track info to localStorage:", String(error));
    }
  }, [trackInfo, setlistId]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(trackUrls).forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, []);

  /**
   * Load a backing track file for a song
   */
  const loadTrack = useCallback((songId: string, file: File) => {
    // Revoke previous URL if exists
    if (trackUrls[songId]) {
      URL.revokeObjectURL(trackUrls[songId]);
    }

    // Create new blob URL
    const url = URL.createObjectURL(file);

    setTrackUrls((prev: Record<string, string>) => ({
      ...prev,
      [songId]: url,
    }));

    setTrackInfo((prev: StoredTrackMapping) => ({
      ...prev,
      [songId]: {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        lastModified: file.lastModified,
      },
    }));
  }, [trackUrls]);

  /**
   * Remove a backing track for a song
   */
  const removeTrack = useCallback((songId: string) => {
    if (trackUrls[songId]) {
      URL.revokeObjectURL(trackUrls[songId]);
    }

    setTrackUrls((prev: Record<string, string>) => {
      const next = { ...prev };
      delete next[songId];
      return next;
    });

    setTrackInfo((prev: StoredTrackMapping) => {
      const next = { ...prev };
      delete next[songId];
      return next;
    });
  }, [trackUrls]);

  /**
   * Get the blob URL for a song's backing track (if loaded)
   */
  const getTrackUrl = useCallback((songId: string): string | null => {
    return trackUrls[songId] || null;
  }, [trackUrls]);

  /**
   * Get the file info for a song's backing track (from localStorage)
   */
  const getTrackInfo = useCallback((songId: string): BackingTrackInfo | null => {
    return trackInfo[songId] || null;
  }, [trackInfo]);

  /**
   * Check if a song has a backing track loaded in memory
   */
  const hasTrackLoaded = useCallback((songId: string): boolean => {
    return Boolean(trackUrls[songId]);
  }, [trackUrls]);

  /**
   * Check if a song had a backing track previously (from localStorage)
   */
  const hadTrackPreviously = useCallback((songId: string): boolean => {
    return Boolean(trackInfo[songId]) && !trackUrls[songId];
  }, [trackInfo, trackUrls]);

  /**
   * Clear all backing tracks
   */
  const clearAllTracks = useCallback(() => {
    Object.values(trackUrls).forEach((url) => {
      URL.revokeObjectURL(url);
    });
    setTrackUrls({});
    setTrackInfo({});
  }, [trackUrls]);

  return {
    loadTrack,
    removeTrack,
    getTrackUrl,
    getTrackInfo,
    hasTrackLoaded,
    hadTrackPreviously,
    clearAllTracks,
    trackInfo,
  };
}
