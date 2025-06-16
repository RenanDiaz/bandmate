import { useEffect, useState } from "react";
import { getMyBands, createBand } from "../services/bandsService";
import { BandList } from "./BandList";
import type { Band } from "./BandList";
import { NewBandForm } from "./NewBandForm";
import { Spinner, Container, Alert } from "reactstrap";

export const BandSelector = ({
  onSelect,
  selectedBand,
}: {
  onSelect: (band: Band) => void;
  selectedBand?: Band;
}) => {
  const [bands, setBands] = useState<Band[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBands = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMyBands();
      setBands(data);
    } catch (e: any) {
      setError(e.message);
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
