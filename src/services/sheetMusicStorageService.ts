import { supabase } from "../lib/supabaseClient";
import { canUserEditContent } from "./bandMembersService";

const BUCKET_NAME = "sheet-music";
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export interface UploadResult {
  path: string;
  publicUrl: string;
}

/**
 * Uploads a PDF file to Supabase Storage
 * Files are organized by band and song: {bandId}/{songId}/{sheetMusicId}.pdf
 */
export async function uploadSheetMusic(
  file: File,
  bandId: number,
  songId: string,
  sheetMusicId: string
): Promise<UploadResult> {
  // Validate file type
  if (file.type !== "application/pdf") {
    throw new Error("Only PDF files are allowed");
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File size exceeds 50MB limit");
  }

  // Check user permission
  const hasPermission = await canUserEditContent(bandId);
  if (!hasPermission) {
    throw new Error("You don't have permission to upload files for this band");
  }

  // Create file path: bandId/songId/sheetMusicId.pdf
  const filePath = `${bandId}/${songId}/${sheetMusicId}.pdf`;

  // Upload file (upsert to allow replacing existing file)
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: "application/pdf",
    });

  if (uploadError) {
    console.error("Upload error:", uploadError);
    throw new Error(`Failed to upload file: ${uploadError.message}`);
  }

  // Get signed URL (valid for 1 year)
  const { data: urlData, error: urlError } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(filePath, 60 * 60 * 24 * 365);

  if (urlError) {
    throw new Error(`Failed to get file URL: ${urlError.message}`);
  }

  return {
    path: filePath,
    publicUrl: urlData.signedUrl,
  };
}

/**
 * Gets a signed URL for a sheet music file
 */
export async function getSheetMusicUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year

  if (error) {
    throw new Error(`Failed to get file URL: ${error.message}`);
  }

  return data.signedUrl;
}

/**
 * A short-lived signed URL for downloading a file into the offline store
 * (offlineSetlistService). Rejects with the storage error as is (its `status`
 * tells not-found from forbidden).
 */
export async function createSheetMusicDownloadUrl(filePath: string, expiresInSeconds = 600): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(filePath, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

/**
 * Sizes of the files in one storage folder ("{bandId}/{songId}"), keyed by
 * full path; null when the listing gave no size. Used to size an offline
 * download before it starts (spec C7): song_sheet_music has no size column.
 */
export async function listSheetMusicFolderSizes(folder: string): Promise<Record<string, number | null>> {
  const { data, error } = await supabase.storage.from(BUCKET_NAME).list(folder, { limit: 1000 });
  if (error) throw error;
  const sizes: Record<string, number | null> = {};
  for (const file of data ?? []) {
    const size = (file.metadata as { size?: unknown } | null)?.size;
    sizes[`${folder}/${file.name}`] = typeof size === "number" ? size : null;
  }
  return sizes;
}

/**
 * Deletes a sheet music file from storage
 */
export async function deleteSheetMusicFile(filePath: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET_NAME).remove([filePath]);

  if (error) {
    console.error("Delete error:", error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}

/**
 * Deletes all sheet music files for a song
 */
export async function deleteAllSheetMusicForSong(
  bandId: number,
  songId: string
): Promise<void> {
  const folderPath = `${bandId}/${songId}`;

  // List all files in the folder
  const { data: files, error: listError } = await supabase.storage
    .from(BUCKET_NAME)
    .list(folderPath);

  if (listError) {
    console.error("List error:", listError);
    throw new Error(`Failed to list files: ${listError.message}`);
  }

  if (files && files.length > 0) {
    const filePaths = files.map((file) => `${folderPath}/${file.name}`);
    const { error: deleteError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove(filePaths);

    if (deleteError) {
      console.error("Delete error:", deleteError);
      throw new Error(`Failed to delete files: ${deleteError.message}`);
    }
  }
}
