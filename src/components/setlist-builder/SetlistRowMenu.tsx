import type { FC, KeyboardEvent as ReactKeyboardEvent, SyntheticEvent } from "react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import { theme } from "../../theme";
import { MOVE_TARGETS, canMove, type MoveTarget } from "../../utils/setlistMove";

interface SetlistRowMenuProps {
  index: number;
  count: number;
  /** The row's title or label, for the trigger's accessible name. */
  itemLabel: string;
  onMove: (target: MoveTarget) => void;
  /** Editor only; the reorder views have no Remove. */
  onRemove?: () => void;
}

const MOVE_ICONS: Record<MoveTarget, string> = {
  up: "bi-arrow-up",
  down: "bi-arrow-down",
  top: "bi-chevron-bar-up",
  bottom: "bi-chevron-bar-down",
};

const MENU_WIDTH = 200;
const GAP = 4;

/**
 * The ⋮ menu on every sortable setlist row (setlist builder, spec §3.5):
 * Move up / down / to top / to bottom and, in the editor, Remove. The
 * non-drag way to reorder, on touch and for keyboard users. The open menu
 * is portaled to `body` with fixed positioning, so scrolling lists and
 * sidebars do not clip it; it closes on scroll, resize, Escape or a press
 * outside.
 */
export const SetlistRowMenu: FC<SetlistRowMenuProps> = ({ index, count, itemLabel, onMove, onRemove }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    setPosition(null);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  // Place below the trigger, or above when there is no room; right-aligned.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const height = menuRef.current?.offsetHeight ?? 0;
    const below = rect.bottom + GAP;
    const top = below + height > window.innerHeight && rect.top - GAP - height > 0 ? rect.top - GAP - height : below;
    const left = Math.max(GAP, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - GAP));
    setPosition({ top, left });
  }, [open]);

  // Focus the first enabled item once the menu is placed (hidden until then).
  const placed = position !== null;
  useEffect(() => {
    if (open && placed) menuRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  }, [open, placed]);

  useEffect(() => {
    if (!open) return;
    const onPress = (event: Event) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) close(false);
    };
    const onDismiss = (event: Event) => {
      // Scrolling inside the menu itself is fine.
      if (event.type === "scroll" && menuRef.current?.contains(event.target as Node)) return;
      close(false);
    };
    document.addEventListener("mousedown", onPress);
    document.addEventListener("touchstart", onPress, { passive: true });
    window.addEventListener("scroll", onDismiss, true);
    window.addEventListener("resize", onDismiss);
    return () => {
      document.removeEventListener("mousedown", onPress);
      document.removeEventListener("touchstart", onPress);
      window.removeEventListener("scroll", onDismiss, true);
      window.removeEventListener("resize", onDismiss);
    };
  }, [open, close]);

  const choose = (action: () => void) => {
    close(true);
    action();
  };

  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const buttons = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "ArrowDown" ? current + 1 : current - 1;
    buttons[(next + buttons.length) % buttons.length]?.focus();
  };

  // Rows can be clickable (performance mode) or sit inside other handlers.
  const stop = (event: SyntheticEvent) => event.stopPropagation();

  return (
    <>
      <Trigger
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={t("setlists.rowMenu.label", { item: itemLabel })}
        title={t("setlists.rowMenu.label", { item: itemLabel })}
        onClick={(event) => {
          stop(event);
          if (open) close(false);
          else setOpen(true);
        }}
        onKeyDown={stop}
      >
        <i className="bi bi-three-dots-vertical" aria-hidden="true"></i>
      </Trigger>
      {open &&
        createPortal(
          <Menu
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={t("setlists.rowMenu.label", { item: itemLabel })}
            style={position ?? { top: 0, left: 0, visibility: "hidden" }}
            onKeyDown={onMenuKeyDown}
            onClick={stop}
            onMouseDown={stop}
          >
            {MOVE_TARGETS.map((target) => (
              <MenuItem
                key={target}
                type="button"
                role="menuitem"
                disabled={!canMove(index, count, target)}
                onClick={() => choose(() => onMove(target))}
              >
                <i className={`bi ${MOVE_ICONS[target]}`} aria-hidden="true"></i>
                {t(`setlists.rowMenu.${target}`)}
              </MenuItem>
            ))}
            {onRemove && (
              <>
                <Divider role="separator" />
                <MenuItem type="button" role="menuitem" $danger onClick={() => choose(onRemove)}>
                  <i className="bi bi-trash" aria-hidden="true"></i>
                  {t("setlists.rowMenu.remove")}
                </MenuItem>
              </>
            )}
          </Menu>,
          document.body
        )}
    </>
  );
};

const Trigger = styled.button`
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  width: 32px;
  height: 32px;
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;

  &:hover,
  &:focus-visible,
  &[aria-expanded="true"] {
    background: var(--color-bg-elevated);
    border-color: ${theme.colors.brand.primary};
    color: ${theme.colors.brand.primary};
  }

  @media (pointer: coarse) {
    width: 44px;
    height: 44px;
  }
`;

const Menu = styled.div`
  position: fixed;
  z-index: 1060;
  width: ${MENU_WIDTH}px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.base};
  box-shadow: var(--shadow-lg);
  padding: ${theme.space[1]} 0;
`;

const MenuItem = styled.button<{ $danger?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  width: 100%;
  min-height: 36px;
  padding: 0 ${theme.space[4]};
  background: transparent;
  border: none;
  text-align: left;
  font-size: ${theme.fontSizes.bodySm};
  color: ${(props) => (props.$danger ? theme.colors.semantic.error : "var(--color-text-primary)")};
  cursor: pointer;

  &:hover:not(:disabled),
  &:focus-visible {
    background: var(--color-bg-tertiary);
    outline: none;
  }

  &:disabled {
    color: var(--color-text-disabled);
    cursor: not-allowed;
  }

  i {
    width: 16px;
    text-align: center;
  }

  @media (pointer: coarse) {
    min-height: 44px;
  }
`;

const Divider = styled.div`
  height: 1px;
  margin: ${theme.space[1]} 0;
  background: var(--color-border);
`;
