import type { FC } from "react";
import { useState } from "react";
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
 *
 * When the image fails to load it shows the band's initial instead of a broken
 * image: offline, `/storage/v1/` is never cached and snapshots keep only the
 * URL (spec §7.3). A new URL tries the image again.
 */
export const BandAvatar: FC<Props> = ({ name, avatarUrl, size = 48, active = false, className }) => {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const failed = !!avatarUrl && failedUrl === avatarUrl;
  const initial = name.trim().charAt(0).toUpperCase();
  return (
    <Wrapper $size={size} $active={active} $hasImage={!!avatarUrl && !failed} className={className}>
      {avatarUrl && !failed ? (
        <Image src={avatarUrl} alt={name} loading="lazy" onError={() => setFailedUrl(avatarUrl)} />
      ) : failed && initial ? (
        <Initial role="img" aria-label={name}>
          {initial}
        </Initial>
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

const Initial = styled.span`
  font-weight: ${theme.fontWeights.semibold};
  line-height: 1;
`;
