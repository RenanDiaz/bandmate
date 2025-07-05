import type { FC } from "react";
import type { Band } from "../services/bandsService";
import { ListGroup, ListGroupItem } from "reactstrap";

interface Props {
  bands: Band[];
  onSelect: (band: Band) => void;
  selectedBandId?: number;
}

export const BandList: FC<Props> = ({ bands, onSelect, selectedBandId }) => (
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
