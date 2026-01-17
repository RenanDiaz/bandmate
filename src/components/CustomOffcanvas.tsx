import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { FC, ReactNode } from "react";
import styled, { keyframes } from "styled-components";
import { theme } from "../theme";

interface CustomOffcanvasProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  mode: "light" | "dark";
}

export const CustomOffcanvas: FC<CustomOffcanvasProps> = ({
  isOpen,
  onClose,
  children,
  mode,
}) => {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);

  // Handle mount/unmount with animation
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
    } else if (shouldRender) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
      }, 300); // Match animation duration
      return () => clearTimeout(timer);
    }
  }, [isOpen, shouldRender]);

  // Lock body scroll when offcanvas is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!shouldRender) return null;

  return createPortal(
    <>
      <Backdrop onClick={onClose} $isClosing={isClosing} />
      <OffcanvasContainer $isClosing={isClosing} $mode={mode}>
        {children}
      </OffcanvasContainer>
    </>,
    document.body
  );
};

// Animations
const fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

const slideIn = keyframes`
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
`;

const fadeOut = keyframes`
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
`;

const slideOut = keyframes`
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(100%);
  }
`;

const Backdrop = styled.div<{ $isClosing: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: ${theme.zIndex.modal - 1};
  animation: ${({ $isClosing }) => ($isClosing ? fadeOut : fadeIn)} 0.3s ease-in-out;
`;

const OffcanvasContainer = styled.div<{
  $isClosing: boolean;
  $mode: "light" | "dark";
}>`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 320px;
  max-width: 85vw;
  background: var(--color-bg-primary);
  border-left: 1px solid var(--color-border);
  box-shadow: var(--shadow-lg);
  z-index: ${theme.zIndex.modal};
  display: flex;
  flex-direction: column;
  animation: ${({ $isClosing }) => ($isClosing ? slideOut : slideIn)} 0.3s ease-in-out;
  overflow-y: auto;
`;

interface OffcanvasHeaderProps {
  onClose: () => void;
  children: ReactNode;
  mode: "light" | "dark";
}

export const OffcanvasHeader: FC<OffcanvasHeaderProps> = ({
  onClose,
  children,
  mode,
}) => {
  return (
    <StyledOffcanvasHeader $mode={mode}>
      {children}
      <CloseButton onClick={onClose} aria-label="Close" $mode={mode}>
        <i className="bi bi-x-lg"></i>
      </CloseButton>
    </StyledOffcanvasHeader>
  );
};

const StyledOffcanvasHeader = styled.div<{ $mode: "light" | "dark" }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${theme.space[4]};
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
`;

const CloseButton = styled.button<{ $mode: "light" | "dark" }>`
  background: transparent;
  border: none;
  color: var(--color-text-primary);
  font-size: ${theme.fontSizes.h5};
  padding: ${theme.space[2]};
  cursor: pointer;
  opacity: 0.7;
  transition: all ${theme.transitions.fast} ease;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${theme.radius.base};

  &:hover {
    opacity: 1;
    background: var(--color-bg-tertiary);
    color: ${theme.colors.brand.primary};
    transform: scale(1.1);
  }

  &:active {
    transform: scale(0.95);
  }
`;

interface OffcanvasBodyProps {
  children: ReactNode;
  mode: "light" | "dark";
}

export const OffcanvasBody: FC<OffcanvasBodyProps> = ({ children, mode }) => {
  return <StyledOffcanvasBody $mode={mode}>{children}</StyledOffcanvasBody>;
};

const StyledOffcanvasBody = styled.div<{ $mode: "light" | "dark" }>`
  padding: ${theme.space[4]};
  display: flex;
  flex-direction: column;
  gap: ${theme.space[4]};
  flex: 1;
  overflow-y: auto;
`;
