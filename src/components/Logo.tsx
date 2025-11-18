import { FC } from 'react';
import styled from 'styled-components';

interface LogoProps {
  size?: number;
  variant?: 'full' | 'icon';
  theme?: 'light' | 'dark';
  className?: string;
}

export const Logo: FC<LogoProps> = ({
  size = 32,
  variant = 'full',
  theme = 'dark',
  className
}) => {
  const textColor = theme === 'dark' ? '#FAFAFA' : '#18181B';

  // Use white/light colors for better visibility on purple backgrounds
  const iconColor = theme === 'dark' ? '#FAFAFA' : '#18181B';
  const accentColor = theme === 'dark' ? '#A78BFA' : '#7C3AED'; // Lighter purple for dark theme

  const BandHubPickIcon = () => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="bandHubPickGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={iconColor} />
          <stop offset="100%" stopColor={accentColor} />
        </linearGradient>
      </defs>

      {/* Central hub - compact guitar pick shape */}
      <path
        d="M 32 20
           C 38 20, 42 22, 42 26
           C 42 30, 39 35, 37 39
           C 35 42, 33 44, 32 44
           C 31 44, 29 42, 27 39
           C 25 35, 22 30, 22 26
           C 22 22, 26 20, 32 20 Z"
        fill="url(#bandHubPickGradient)"
        opacity="0.15"
      />
      <path
        d="M 32 20
           C 38 20, 42 22, 42 26
           C 42 30, 39 35, 37 39
           C 35 42, 33 44, 32 44
           C 31 44, 29 42, 27 39
           C 25 35, 22 30, 22 26
           C 22 22, 26 20, 32 20 Z"
        stroke="url(#bandHubPickGradient)"
        strokeWidth="2.5"
        fill="none"
      />

      {/* "B" in center of pick */}
      <text
        x="32"
        y="35"
        textAnchor="middle"
        fill={iconColor}
        fontSize="12"
        fontWeight="700"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        B
      </text>

      {/* Spokes connecting to different aspects */}
      <g opacity="0.5">
        {/* Spoke to Songs (top) */}
        <line x1="32" y1="20" x2="32" y2="12" stroke="url(#bandHubPickGradient)" strokeWidth="2" />

        {/* Spoke to Members (top-right) */}
        <line x1="39" y1="24" x2="46" y2="20" stroke="url(#bandHubPickGradient)" strokeWidth="2" />

        {/* Spoke to Shows (right) */}
        <line x1="42" y1="31" x2="52" y2="32" stroke="url(#bandHubPickGradient)" strokeWidth="2" />

        {/* Spoke to Setlists (bottom-right) */}
        <line x1="38" y1="38" x2="46" y2="44" stroke="url(#bandHubPickGradient)" strokeWidth="2" />

        {/* Spoke to Schedule (bottom) */}
        <line x1="32" y1="44" x2="32" y2="52" stroke="url(#bandHubPickGradient)" strokeWidth="2" />

        {/* Spoke to Collaboration (bottom-left) */}
        <line x1="26" y1="38" x2="18" y2="44" stroke="url(#bandHubPickGradient)" strokeWidth="2" />

        {/* Spoke to Library (left) */}
        <line x1="22" y1="31" x2="12" y2="32" stroke="url(#bandHubPickGradient)" strokeWidth="2" />

        {/* Spoke to Communication (top-left) */}
        <line x1="25" y1="24" x2="18" y2="20" stroke="url(#bandHubPickGradient)" strokeWidth="2" />
      </g>

      {/* Feature nodes at end of spokes */}

      {/* Songs - Top */}
      <g>
        <circle cx="32" cy="10" r="4.5" fill="url(#bandHubPickGradient)" opacity="0.9" />
        <g transform="translate(32, 10) scale(0.25)">
          <ellipse cx="0" cy="0" rx="3" ry="2.5" fill={theme === 'dark' ? '#18181B' : '#FAFAFA'} />
          <rect x="2.5" y="-6" width="1.5" height="6" rx="0.75" fill={theme === 'dark' ? '#18181B' : '#FAFAFA'} />
        </g>
      </g>

      {/* Members - Top Right */}
      <g>
        <circle cx="46" cy="18" r="4.5" fill="url(#bandHubPickGradient)" opacity="0.9" />
        <g transform="translate(46, 18) scale(0.3)">
          <circle cx="0" cy="-1" r="2.5" fill={theme === 'dark' ? '#18181B' : '#FAFAFA'} />
          <circle cx="-3" cy="2" r="1.5" fill={theme === 'dark' ? '#18181B' : '#FAFAFA'} opacity="0.7" />
          <circle cx="3" cy="2" r="1.5" fill={theme === 'dark' ? '#18181B' : '#FAFAFA'} opacity="0.7" />
        </g>
      </g>

      {/* Shows - Right */}
      <g>
        <circle cx="54" cy="32" r="4.5" fill="url(#bandHubPickGradient)" opacity="0.9" />
        <g transform="translate(54, 32) scale(0.3)">
          <rect x="-2" y="-3" width="4" height="6" rx="1" fill={theme === 'dark' ? '#18181B' : '#FAFAFA'} />
          <line x1="-4" y1="-1" x2="-6" y2="-3" stroke={theme === 'dark' ? '#18181B' : '#FAFAFA'} strokeWidth="1.5" />
          <line x1="4" y1="-1" x2="6" y2="-3" stroke={theme === 'dark' ? '#18181B' : '#FAFAFA'} strokeWidth="1.5" />
        </g>
      </g>

      {/* Setlists - Bottom Right */}
      <g>
        <circle cx="46" cy="46" r="4.5" fill="url(#bandHubPickGradient)" opacity="0.9" />
        <g transform="translate(46, 46) scale(0.22)">
          <rect x="-3" y="-4" width="6" height="8" rx="1" stroke={theme === 'dark' ? '#18181B' : '#FAFAFA'} strokeWidth="1" fill="none" />
          <line x1="-2" y1="-2" x2="2" y2="-2" stroke={theme === 'dark' ? '#18181B' : '#FAFAFA'} strokeWidth="1" />
          <line x1="-2" y1="0" x2="2" y2="0" stroke={theme === 'dark' ? '#18181B' : '#FAFAFA'} strokeWidth="1" />
          <line x1="-2" y1="2" x2="2" y2="2" stroke={theme === 'dark' ? '#18181B' : '#FAFAFA'} strokeWidth="1" />
        </g>
      </g>

      {/* Schedule - Bottom */}
      <g>
        <circle cx="32" cy="54" r="4.5" fill="url(#bandHubPickGradient)" opacity="0.9" />
        <g transform="translate(32, 54) scale(0.22)">
          <rect x="-3" y="-3" width="6" height="6" rx="1" stroke={theme === 'dark' ? '#18181B' : '#FAFAFA'} strokeWidth="1" fill="none" />
          <line x1="-2" y1="-1" x2="2" y2="-1" stroke={theme === 'dark' ? '#18181B' : '#FAFAFA'} strokeWidth="0.8" />
          <line x1="-2" y1="1" x2="2" y2="1" stroke={theme === 'dark' ? '#18181B' : '#FAFAFA'} strokeWidth="0.8" />
          <circle cx="0" cy="0" r="1" fill={theme === 'dark' ? '#18181B' : '#FAFAFA'} />
        </g>
      </g>

      {/* Collaboration - Bottom Left */}
      <g>
        <circle cx="18" cy="46" r="4.5" fill="url(#bandHubPickGradient)" opacity="0.9" />
        <g transform="translate(18, 46) scale(0.25)">
          <circle cx="-2" cy="0" r="2" fill={theme === 'dark' ? '#18181B' : '#FAFAFA'} />
          <circle cx="2" cy="0" r="2" fill={theme === 'dark' ? '#18181B' : '#FAFAFA'} opacity="0.7" />
        </g>
      </g>

      {/* Library - Left */}
      <g>
        <circle cx="10" cy="32" r="4.5" fill="url(#bandHubPickGradient)" opacity="0.9" />
        <g transform="translate(10, 32) scale(0.22)">
          <rect x="-3" y="-4" width="2" height="8" rx="0.5" fill={theme === 'dark' ? '#18181B' : '#FAFAFA'} />
          <rect x="-0.5" y="-4" width="2" height="8" rx="0.5" fill={theme === 'dark' ? '#18181B' : '#FAFAFA'} opacity="0.7" />
          <rect x="2" y="-4" width="2" height="8" rx="0.5" fill={theme === 'dark' ? '#18181B' : '#FAFAFA'} opacity="0.5" />
        </g>
      </g>

      {/* Communication - Top Left */}
      <g>
        <circle cx="18" cy="18" r="4.5" fill="url(#bandHubPickGradient)" opacity="0.9" />
        <g transform="translate(18, 18) scale(0.25)">
          <path d="M -3 -2 L 3 -2 L 3 2 L 0 2 L -2 4 L -2 2 L -3 2 Z" fill={theme === 'dark' ? '#18181B' : '#FAFAFA'} />
        </g>
      </g>

      {/* Outer circle suggesting ecosystem */}
      <circle
        cx="32"
        cy="32"
        r="28"
        stroke="url(#bandHubPickGradient)"
        strokeWidth="1"
        fill="none"
        opacity="0.2"
      />
    </svg>
  );

  if (variant === 'icon') {
    return <BandHubPickIcon />;
  }

  return (
    <LogoContainer className={className}>
      <BandHubPickIcon />
      <LogoText style={{ color: textColor, fontSize: size * 0.5 }}>
        Bandmate
      </LogoText>
    </LogoContainer>
  );
};

const LogoContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const LogoText = styled.span`
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1;
`;
