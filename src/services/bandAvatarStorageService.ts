import { supabase } from "../lib/supabaseClient";

const BUCKET_NAME = "band-avatars";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/**
 * Uploads (or replaces) a band's avatar and returns its public URL.
 * Files are stored at a fixed path per band: {bandId}/avatar
 * Only owners/admins can write to this bucket (enforced by storage RLS).
 */
export async function uploadBandAvatar(file: File, bandId: number): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Only PNG, JPEG, WEBP or GIF images are allowed");
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Image size exceeds 5MB limit");
  }

  const filePath = `${bandId}/avatar`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type,
    });

  if (uploadError) {
    console.error("Avatar upload error:", uploadError);
    throw new Error(`Failed to upload avatar: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);

  // Append a cache-busting param so a replaced avatar (same path) refreshes
  // immediately in the browser instead of serving the stale cached image.
  return `${data.publicUrl}?v=${Date.now()}`;
}

/**
 * Removes a band's avatar from storage.
 */
export async function deleteBandAvatar(bandId: number): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([`${bandId}/avatar`]);

  if (error) {
    console.error("Avatar delete error:", error);
    throw new Error(`Failed to remove avatar: ${error.message}`);
  }
}
