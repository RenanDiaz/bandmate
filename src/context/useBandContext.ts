import { useContext } from "react";
import { BandContext } from "./BandContext";

export const useBandContext = () => {
  const ctx = useContext(BandContext);
  if (!ctx) throw new Error("useBandContext must be used within BandProvider");
  return ctx;
};
