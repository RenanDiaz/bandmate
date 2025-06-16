import { useEffect, useState } from "react";
import { getMySongs } from "../services/songsService";
import { NewSongForm } from "./NewSongForm";
import { SongList } from "./SongList";
import { Spinner, Container } from "reactstrap";

const SongsView = ({ user }: { user: any }) => {
  const [songs, setSongs] = useState<any[]>([]);
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
