import type { FC } from "react";
import type { Song } from "../services/songsService";
import { ListGroup, ListGroupItem } from "reactstrap";

interface Props {
  songs: Song[];
}

export const SongList: FC<Props> = ({ songs }) => (
  <ListGroup>
    {songs.map((song) => (
      <ListGroupItem key={song.id}>
        <strong>{song.title}</strong> {song.artist && `– ${song.artist}`}
      </ListGroupItem>
    ))}
  </ListGroup>
);
