import { useState } from "react";
import { Form, FormGroup, Input, Button } from "reactstrap";

export const NewBandForm = ({ onBandCreated }: { onBandCreated: (name: string) => void }) => {
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onBandCreated(name.trim());
    setName("");
  };

  return (
    <Form onSubmit={handleSubmit} className="mb-3">
      <FormGroup className="mb-2">
        <Input
          placeholder="Band name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </FormGroup>
      <Button type="submit" color="primary">
        Add Band
      </Button>
    </Form>
  );
};
