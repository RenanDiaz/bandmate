import { ListGroup, ListGroupItem } from "reactstrap";

interface Song {
  id: number;
  title: string;
  artist?: string;
}

export const SongList = ({ songs }: { songs: Song[] }) => (
  <ListGroup>
    {songs.map((song) => (
      <ListGroupItem key={song.id}>
        <strong>{song.title}</strong> {song.artist && `– ${song.artist}`}
      </ListGroupItem>
    ))}
  </ListGroup>
);
