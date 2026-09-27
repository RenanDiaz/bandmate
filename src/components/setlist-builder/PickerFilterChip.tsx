import { useEffect, useId, useRef, useState } from "react";
import styled from "styled-components";
import { theme } from "../../theme";

export interface PickerFilterOption<T extends string> {
  value: T;
  label: string;
}

interface PickerFilterChipProps<T extends string> {
  label: string;
  options: PickerFilterOption<T>[];
  selected: T[];
  onChange: (selected: T[]) => void;
  /** 44 px targets on touch. */
  touch: boolean;
}

/**
 * One filter chip of the song picker (spec §3.2): a button that opens a
 * small popover of checkboxes. Multi-value, OR within the chip. Inline, no
 * portal; closes on Escape or a press outside.
 */
export function PickerFilterChip<T extends string>({ label, options, selected, onChange, touch }: PickerFilterChipProps<T>) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();

  useEffect(() => {
    if (!open) return;
    const onPress = (event: Event) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Handled: the full-screen picker around it stays open.
      event.preventDefault();
      setOpen(false);
    };
    document.addEventListener("mousedown", onPress);
    document.addEventListener("touchstart", onPress, { passive: true });
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPress);
      document.removeEventListener("touchstart", onPress);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = (value: T) =>
    onChange(selected.includes(value) ? selected.filter((entry) => entry !== value) : [...selected, value]);

  return (
    <ChipWrapper ref={wrapperRef}>
      <Chip
        type="button"
        $active={selected.length > 0}
        $touch={touch}
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
        {selected.length > 0 && <ChipCount>{selected.length}</ChipCount>}
        <i className={`bi bi-chevron-${open ? "up" : "down"}`} aria-hidden="true"></i>
      </Chip>
      {open && (
        <Popover id={popoverId} role="group" aria-label={label}>
          {options.map((option) => (
            <OptionLabel key={option.value} $touch={touch}>
              <input
                type="checkbox"
                checked={selected.includes(option.value)}
                onChange={() => toggle(option.value)}
              />
              <span>{option.label}</span>
            </OptionLabel>
          ))}
        </Popover>
      )}
    </ChipWrapper>
  );
}

const ChipWrapper = styled.div`
  position: relative;
`;

const Chip = styled.button<{ $active: boolean; $touch: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[2]};
  min-height: ${(props) => (props.$touch ? "44px" : "32px")};
  padding: 0 ${theme.space[3]};
  border-radius: ${theme.radius.full};
  border: 1px solid ${(props) => (props.$active ? theme.colors.brand.primary : "var(--color-border)")};
  background: ${(props) => (props.$active ? "rgba(139, 92, 246, 0.15)" : "var(--color-bg-primary)")};
  color: ${(props) => (props.$active ? theme.colors.brand.primary : "var(--color-text-secondary)")};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;
  white-space: nowrap;

  i {
    font-size: ${theme.fontSizes.bodyXs};
  }

  &:hover {
    border-color: ${theme.colors.brand.primary};
  }
`;

const ChipCount = styled.span`
  background: ${theme.colors.brand.primary};
  color: white;
  border-radius: ${theme.radius.full};
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  font-size: ${theme.fontSizes.bodyXs};
  display: inline-flex;
  align-items: center;
  justify-content: center;
`;

const Popover = styled.div`
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 20;
  min-width: 200px;
  max-height: 260px;
  overflow-y: auto;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.base};
  box-shadow: var(--shadow-lg);
  padding: ${theme.space[2]} 0;
`;

const OptionLabel = styled.label<{ $touch: boolean }>`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  min-height: ${(props) => (props.$touch ? "44px" : "32px")};
  padding: 0 ${theme.space[4]};
  margin: 0;
  color: var(--color-text-primary);
  font-size: ${theme.fontSizes.bodySm};
  cursor: pointer;

  &:hover {
    background: var(--color-bg-tertiary);
  }

  input {
    accent-color: ${theme.colors.brand.primary};
    width: 16px;
    height: 16px;
  }
`;
