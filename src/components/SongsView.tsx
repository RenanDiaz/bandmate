import type { FC } from "react";
import type { User } from "@supabase/supabase-js";
import type { Song } from "../services/songsService";
import { useEffect, useState } from "react";
import { Spinner, Container } from "reactstrap";
import { getMySongs } from "../services/songsService";
import { NewSongForm } from "./NewSongForm";
import { SongList } from "./SongList";

interface Props {
  user: User | null;
}

const SongsView: FC<Props> = ({ user }) => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSongs = async () => {
    setLoading(true);
    const songs = await getMySongs();
    setSongs(songs);
    setLoading(false);
  };

  useEffect(() => {
    if (user) loadSongs();
  }, [user]);

  if (!user)
    return (
      <Container className="mt-4">
        <p>Please sign in to view your songs</p>
      </Container>
    );
  return (
    <Container className="mt-4">
      <NewSongForm onSongCreated={loadSongs} />
      {loading ? <Spinner color="primary" /> : <SongList songs={songs} />}
    </Container>
  );
};

export default SongsView;
