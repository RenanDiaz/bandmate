import type { FC } from "react";
import { useEffect, useState } from "react";
import { Spinner, Container, Alert } from "reactstrap";
import { createBand, getMyBands, type Band } from "../services/bandsService";
import { BandList } from "./BandList";
import { NewBandForm } from "./NewBandForm";

interface Props {
  selectedBand?: Band;
  onSelect: (band: Band) => void;
}

export const BandSelector: FC<Props> = ({ onSelect, selectedBand }) => {
  const [bands, setBands] = useState<Band[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBands = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMyBands();
      setBands(data);
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError("An unexpected error occurred.");
      }
    }
    setLoading(false);
  };

  const handleBandCreated = async (name: string) => {
    await createBand(name);
    loadBands();
  };

  useEffect(() => {
    loadBands();
  }, []);

  return (
    <Container className="mt-4">
      <h4>Select a band</h4>
      <NewBandForm onBandCreated={handleBandCreated} />
      {loading ? (
        <Spinner color="primary" />
      ) : error ? (
        <Alert color="danger">{error}</Alert>
      ) : (
        <BandList bands={bands} onSelect={onSelect} selectedBandId={selectedBand?.id} />
      )}
    </Container>
  );
};
