import { useLocation } from "react-router-dom";

/** Renders the current pathname (and the query in `data-search`) so DOM tests can assert the route never changed. */
export const LocationProbe = () => {
  const location = useLocation();
  return (
    <output data-testid="location" data-search={location.search}>
      {location.pathname}
    </output>
  );
};
