import { supabase } from "../lib/supabaseClient";

export async function getMySongs() {
  const { data, error } = await supabase
    .from("songs")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function createSong(song: {
  title: string;
  artist?: string;
  lyrics?: string;
  chords?: string;
}) {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) throw new Error("User not authenticated");

  const { data, error } = await supabase.from("songs").insert([{ ...song, user_id: user.id }]);

  if (error) throw error;
  return data;
}
