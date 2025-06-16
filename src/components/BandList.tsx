import { ListGroup, ListGroupItem } from "reactstrap";

export interface Band {
  id: number;
  name: string;
}

export const BandList = ({
  bands,
  onSelect,
  selectedBandId,
}: {
  bands: Band[];
  onSelect: (band: Band) => void;
  selectedBandId?: number;
}) => (
  <ListGroup>
    {bands.map((band) => (
      <ListGroupItem
        key={band.id}
        active={selectedBandId === band.id}
        action
        onClick={() => onSelect(band)}
        style={{ cursor: "pointer" }}
      >
        {band.name}
      </ListGroupItem>
    ))}
  </ListGroup>
);
