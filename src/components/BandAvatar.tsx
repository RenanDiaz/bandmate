import type { FC } from "react";
import styled from "styled-components";
import { theme } from "../theme";

interface Props {
  name: string;
  avatarUrl?: string | null;
  /** Pixel size of the (square) avatar. Defaults to 48. */
  size?: number;
  /** Highlight styling (e.g. for the selected band). */
  active?: boolean;
  className?: string;
}

/**
 * Renders a band's avatar image, falling back to a music-note icon when the
 * band has no avatar set. Shared across the band list, switcher and settings.
 */
export const BandAvatar: FC<Props> = ({ name, avatarUrl, size = 48, active = false, className }) => {
  return (
    <Wrapper $size={size} $active={active} $hasImage={!!avatarUrl} className={className}>
      {avatarUrl ? (
        <Image src={avatarUrl} alt={name} loading="lazy" />
      ) : (
        <i className="bi bi-music-note-beamed" aria-hidden="true"></i>
      )}
    </Wrapper>
  );
};

const Wrapper = styled.div<{ $size: number; $active: boolean; $hasImage: boolean }>`
  width: ${(props) => props.$size}px;
  height: ${(props) => props.$size}px;
  flex-shrink: 0;
  border-radius: ${theme.radius.md};
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${(props) =>
    props.$hasImage
      ? "var(--color-bg-elevated)"
      : props.$active
      ? theme.gradients.brandPrimary
      : "var(--color-bg-elevated)"};
  color: ${(props) => (props.$active ? "white" : "var(--color-text-secondary)")};
  font-size: ${(props) => Math.round(props.$size * 0.42)}px;
  transition: all ${theme.transitions.base} ease;
`;

const Image = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`;
