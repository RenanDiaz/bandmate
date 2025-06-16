import { useState } from "react";
import { createSong } from "../services/songsService";
import { Form, FormGroup, Input, Button, Container } from "reactstrap";

interface Props {
  onSongCreated: () => void;
}

export const NewSongForm = ({ onSongCreated }: Props) => {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createSong({ title, artist });
    setTitle("");
    setArtist("");
    onSongCreated();
  };

  return (
    <Container className="p-0">
      <Form onSubmit={handleSubmit} className="mb-4">
        <FormGroup className="mb-2">
          <Input
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </FormGroup>
        <FormGroup className="mb-2">
          <Input placeholder="Artist" value={artist} onChange={(e) => setArtist(e.target.value)} />
        </FormGroup>
        <Button type="submit" color="success">
          Save song
        </Button>
      </Form>
    </Container>
  );
};
