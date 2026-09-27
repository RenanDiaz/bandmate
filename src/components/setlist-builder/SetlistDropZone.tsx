import type { FC, ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SETLIST_DROP_ID } from "./pickerDnd";

/** The setlist list as a drop target: dropping below the last row appends. */
export const SetlistDropZone: FC<{ children: ReactNode }> = ({ children }) => {
  const { setNodeRef } = useDroppable({ id: SETLIST_DROP_ID });
  return (
    <div ref={setNodeRef} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {children}
    </div>
  );
};
