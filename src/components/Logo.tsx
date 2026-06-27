import type { FC } from 'react';
import { useId } from 'react';
import styled from 'styled-components';

interface LogoProps {
  size?: number;
  variant?: 'full' | 'icon';
  theme?: 'light' | 'dark';
  /**
   * Render the negative treatment (white pick with a knocked-out "B") for use
   * on the brand purple / saturated backgrounds where the solid purple mark
   * would lack contrast.
   */
  onAccent?: boolean;
  className?: string;
}

// Brand accent (purple). The symbol keeps the accent in both light and dark.
const ACCENT = '#8B5CF6';

const PICK_PATH =
  'M32 7 C47 7 55 16 55 28 C55 43 40 53 32 57 C24 53 9 43 9 28 C9 16 17 7 32 7 Z';

/**
 * Bandmate logo — Concept A: "Pick + Monograma".
 * A single solid guitar-pick silhouette in brand purple with a white "B"
 * monogram. No nodes or spokes — maximum legibility down to favicon sizes.
 */
export const Logo: FC<LogoProps> = ({
  size = 32,
  variant = 'full',
  theme = 'dark',
  onAccent = false,
  className,
}) => {
  const maskId = useId();
  const wordInk = onAccent ? '#FFFFFF' : theme === 'dark' ? '#FAFAFA' : '#18181B';
  const accentInk = onAccent ? '#FFFFFF' : ACCENT;

  const PickMonogram = () => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Bandmate"
    >
      {onAccent ? (
        // White pick with the "B" knocked out so the background shows through.
        <>
          <defs>
            <mask id={maskId}>
              <rect x="0" y="0" width="64" height="64" fill="#fff" />
              <text
                x="32"
                y="43"
                textAnchor="middle"
                fontFamily="'Space Grotesk', system-ui, -apple-system, sans-serif"
                fontWeight="700"
                fontSize="30"
                fill="#000"
              >
                B
              </text>
            </mask>
          </defs>
          <path d={PICK_PATH} fill="#FFFFFF" mask={`url(#${maskId})`} />
        </>
      ) : (
        <>
          <path d={PICK_PATH} fill={ACCENT} />
          <text
            x="32"
            y="43"
            textAnchor="middle"
            fontFamily="'Space Grotesk', system-ui, -apple-system, sans-serif"
            fontWeight="700"
            fontSize="30"
            fill="#FFFFFF"
          >
            B
          </text>
        </>
      )}
    </svg>
  );

  if (variant === 'icon') {
    return <PickMonogram />;
  }

  return (
    <LogoContainer className={className}>
      <PickMonogram />
      <Wordmark style={{ fontSize: size * 0.72 }}>
        <span style={{ color: wordInk }}>Band</span>
        <span style={{ color: accentInk }}>mate</span>
      </Wordmark>
    </LogoContainer>
  );
};

const LogoContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const Wordmark = styled.span`
  font-family: 'Space Grotesk', system-ui, -apple-system, sans-serif;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1;
  white-space: nowrap;
`;
