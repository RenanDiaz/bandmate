import type { FC, ReactNode } from "react";
import { useEffect } from "react";
import styled from "styled-components";

interface PickerSheetProps {
  label: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Full-screen container for the song picker on narrow screens (spec §2).
 * Rendered only while open, without a route change; Escape closes it, and
 * the page behind does not scroll. Stays below reactstrap modals (1055) so
 * "Edit song" opens on top of it.
 */
export const PickerSheet: FC<PickerSheetProps> = ({ label, onClose, children }) => {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <Sheet role="dialog" aria-modal="true" aria-label={label}>
      {children}
    </Sheet>
  );
};

const Sheet = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1045;
  background: var(--color-bg-secondary);
  display: flex;
  flex-direction: column;
  padding-top: env(safe-area-inset-top, 0px);

  > * {
    flex: 1;
    min-height: 0;
  }
`;
