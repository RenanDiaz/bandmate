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
 * Files are organized by band: {bandId}/{songId}.pdf
 */
export async function uploadSheetMusic(
  file: File,
  bandId: number,
  songId: string
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

  // Create file path: bandId/songId.pdf
  const filePath = `${bandId}/${songId}.pdf`;

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
 * Deletes a sheet music file from storage
 */
export async function deleteSheetMusic(
  bandId: number,
  songId: string
): Promise<void> {
  // Check user permission
  const hasPermission = await canUserEditContent(bandId);
  if (!hasPermission) {
    throw new Error("You don't have permission to delete files for this band");
  }

  const filePath = `${bandId}/${songId}.pdf`;

  const { error } = await supabase.storage.from(BUCKET_NAME).remove([filePath]);

  if (error) {
    console.error("Delete error:", error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}

/**
 * Checks if a sheet music file exists
 */
export async function sheetMusicExists(
  bandId: number,
  songId: string
): Promise<boolean> {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .list(String(bandId), {
      search: `${songId}.pdf`,
    });

  if (error) {
    console.error("Check exists error:", error);
    return false;
  }

  return data.length > 0;
}
