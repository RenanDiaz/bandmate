import { useLocation } from "react-router-dom";

/** Renders the current pathname so DOM tests can assert the route never changed. */
export const LocationProbe = () => <output data-testid="location">{useLocation().pathname}</output>;
