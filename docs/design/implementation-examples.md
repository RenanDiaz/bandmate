# Bandmate Style Guide - Implementation Examples

This document provides practical, copy-paste ready examples for implementing the Bandmate design system in your components.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Button Examples](#button-examples)
3. [Card Examples](#card-examples)
4. [Form Examples](#form-examples)
5. [Navigation Examples](#navigation-examples)
6. [Modal Examples](#modal-examples)
7. [Badge & Label Examples](#badge--label-examples)
8. [Loading State Examples](#loading-state-examples)
9. [Empty State Examples](#empty-state-examples)
10. [Complete Component Examples](#complete-component-examples)

---

## Getting Started

### Option 1: Using Styled Components with Theme

```typescript
import { ThemeProvider } from 'styled-components';
import { theme } from './theme';

function App() {
  const [mode, setMode] = useState<'light' | 'dark'>('dark');

  return (
    <ThemeProvider theme={{ ...theme, mode }}>
      {/* Your components */}
    </ThemeProvider>
  );
}
```

### Option 2: Using CSS Custom Properties

```typescript
// In your main.tsx or App.tsx
import './styles/design-tokens.css';

// Then use the custom properties in your styled components or CSS
const Card = styled.div`
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-6);
`;
```

---

## Button Examples

### Primary Button

```typescript
import styled from 'styled-components';
import { Button as BSButton } from 'reactstrap';

const PrimaryButton = styled(BSButton)`
  background: var(--color-brand-primary);
  border-color: var(--color-brand-primary);
  color: white;
  font-weight: var(--font-weight-medium);
  border-radius: var(--radius-base);
  padding: var(--space-3) var(--space-6);
  letter-spacing: var(--letter-spacing-wide);
  transition: all var(--transition-base) ease;

  &:hover {
    background: var(--color-brand-primary-hover);
    border-color: var(--color-brand-primary-hover);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  &:active {
    background: var(--color-brand-primary-active);
    border-color: var(--color-brand-primary-active);
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

// Usage
<PrimaryButton>
  <i className="bi bi-plus-circle me-2"></i>
  Create Song
</PrimaryButton>
```

### Secondary Button (Outline)

```typescript
const SecondaryButton = styled(BSButton)`
  background: transparent;
  border: 2px solid var(--color-border-strong);
  color: var(--color-text-primary);
  font-weight: var(--font-weight-medium);
  border-radius: var(--radius-base);
  padding: var(--space-3) var(--space-6);
  transition: all var(--transition-base) ease;

  &:hover {
    background: var(--color-bg-hover);
    border-color: var(--color-text-secondary);
    transform: translateY(-1px);
  }
`;

// Usage
<SecondaryButton onClick={handleCancel}>
  Cancel
</SecondaryButton>
```

### Icon Button

```typescript
const IconButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-base);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-base) ease;

  &:hover {
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }

  i {
    font-size: var(--icon-size-base);
  }
`;

// Usage
<IconButton aria-label="Edit song" onClick={handleEdit}>
  <i className="bi bi-pencil"></i>
</IconButton>
```

### Button with Loading State

```typescript
interface ButtonProps {
  loading?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}

const LoadingButton = styled(PrimaryButton)`
  position: relative;

  &.loading {
    color: transparent;
    pointer-events: none;
  }
`;

const Spinner = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;

  @keyframes spin {
    to { transform: translate(-50%, -50%) rotate(360deg); }
  }
`;

function ButtonWithLoading({ loading, children, onClick }: ButtonProps) {
  return (
    <LoadingButton
      className={loading ? 'loading' : ''}
      onClick={onClick}
      disabled={loading}
    >
      {loading && <Spinner />}
      {children}
    </LoadingButton>
  );
}

// Usage
<ButtonWithLoading loading={isCreating} onClick={handleCreate}>
  Create Band
</ButtonWithLoading>
```

---

## Card Examples

### Basic Song Card

```typescript
import { Card, CardBody } from 'reactstrap';
import styled from 'styled-components';

const SongCard = styled(Card)`
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-base);
  transition: all var(--transition-slow) ease;
  cursor: pointer;

  &:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-lg);
    border-color: var(--color-brand-primary);
  }
`;

const SongTitle = styled.h3`
  font-size: var(--font-size-h3);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0 0 var(--space-2) 0;
`;

const SongArtist = styled.p`
  font-size: var(--font-size-body-sm);
  color: var(--color-text-secondary);
  margin: 0 0 var(--space-4) 0;
`;

const SongMeta = styled.div`
  display: flex;
  gap: var(--space-4);
  font-size: var(--font-size-body-xs);
  color: var(--color-text-tertiary);

  span {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }
`;

// Usage
<SongCard onClick={() => handleSongClick(song.id)}>
  <CardBody>
    <SongTitle>{song.title}</SongTitle>
    <SongArtist>{song.artist}</SongArtist>
    <SongMeta>
      <span>
        <i className="bi bi-calendar"></i>
        {formatDate(song.created_at)}
      </span>
      <span>
        <i className="bi bi-music-note"></i>
        {song.key || 'No key'}
      </span>
    </SongMeta>
  </CardBody>
</SongCard>
```

### Selection Card (for Band Selector)

```typescript
interface SelectionCardProps {
  selected?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}

const SelectionCardContainer = styled.div<{ selected?: boolean }>`
  position: relative;
  background: var(--color-bg-secondary);
  border: 2px solid ${props =>
    props.selected ? 'var(--color-brand-primary)' : 'var(--color-border)'};
  border-radius: var(--radius-md);
  padding: var(--space-6);
  cursor: pointer;
  transition: all var(--transition-base) ease;

  &:hover {
    border-color: ${props =>
      props.selected ? 'var(--color-brand-primary-hover)' : 'var(--color-text-tertiary)'};
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }

  ${props => props.selected && `
    background: linear-gradient(
      135deg,
      rgba(139, 92, 246, 0.05) 0%,
      rgba(139, 92, 246, 0.02) 100%
    );
    box-shadow: var(--shadow-glow);
  `}
`;

const CardContent = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-4);
`;

const CardIcon = styled.div`
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gradient-brand-primary);
  border-radius: var(--radius-base);
  color: white;
  font-size: var(--icon-size-xl);
`;

const CardInfo = styled.div`
  flex: 1;
`;

const CardTitle = styled.h4`
  font-size: var(--font-size-h4);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0 0 var(--space-1) 0;
`;

const CardSubtitle = styled.p`
  font-size: var(--font-size-body-sm);
  color: var(--color-text-secondary);
  margin: 0;
`;

const CheckBadge = styled.div`
  position: absolute;
  top: var(--space-4);
  right: var(--space-4);
  color: var(--color-brand-primary);
  font-size: var(--icon-size-lg);
`;

// Usage
<SelectionCardContainer selected={isSelected} onClick={() => onSelect(band)}>
  <CardContent>
    <CardIcon>
      <i className="bi bi-music-note-beamed"></i>
    </CardIcon>
    <CardInfo>
      <CardTitle>{band.name}</CardTitle>
      <CardSubtitle>{band.songCount} songs</CardSubtitle>
    </CardInfo>
  </CardContent>
  {isSelected && (
    <CheckBadge>
      <i className="bi bi-check-circle-fill"></i>
    </CheckBadge>
  )}
</SelectionCardContainer>
```

---

## Form Examples

### Input Field with Label

```typescript
import { FormGroup, Label, Input, FormText } from 'reactstrap';
import styled from 'styled-components';

const StyledFormGroup = styled(FormGroup)`
  margin-bottom: var(--space-6);
`;

const StyledLabel = styled(Label)`
  font-size: var(--font-size-body-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  margin-bottom: var(--space-2);
  display: block;
`;

const StyledInput = styled(Input)`
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  border-radius: var(--radius-base);
  padding: var(--space-3) var(--space-4);
  font-size: var(--font-size-body);
  transition: all var(--transition-base) ease;

  &::placeholder {
    color: var(--color-text-tertiary);
  }

  &:focus {
    background: var(--color-bg-elevated);
    border-color: var(--color-brand-primary);
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
    outline: none;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const StyledFormText = styled(FormText)`
  font-size: var(--font-size-body-xs);
  color: var(--color-text-tertiary);
  margin-top: var(--space-2);
`;

// Usage
<StyledFormGroup>
  <StyledLabel for="songTitle">Song Title</StyledLabel>
  <StyledInput
    id="songTitle"
    type="text"
    placeholder="Enter song title"
    value={title}
    onChange={(e) => setTitle(e.target.value)}
  />
  <StyledFormText>
    This is how it will appear in your setlists
  </StyledFormText>
</StyledFormGroup>
```

### Textarea for Lyrics/Chords

```typescript
const LyricsTextarea = styled(StyledInput).attrs({ type: 'textarea' })`
  font-family: var(--font-mono);
  font-size: var(--font-size-body);
  line-height: var(--line-height-loose);
  min-height: 300px;
  resize: vertical;
`;

// Usage
<StyledFormGroup>
  <StyledLabel for="lyrics">Lyrics</StyledLabel>
  <LyricsTextarea
    id="lyrics"
    placeholder="Paste or type lyrics here..."
    rows={12}
    value={lyrics}
    onChange={(e) => setLyrics(e.target.value)}
  />
</StyledFormGroup>
```

### Form with Validation

```typescript
interface ValidationState {
  error?: string;
  success?: string;
}

const InputWrapper = styled.div<{ error?: boolean; success?: boolean }>`
  position: relative;

  ${StyledInput} {
    ${props => props.error && `
      border-color: var(--color-error);

      &:focus {
        border-color: var(--color-error);
        box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
      }
    `}

    ${props => props.success && `
      border-color: var(--color-success);
      padding-right: var(--space-10);

      &:focus {
        border-color: var(--color-success);
        box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
      }
    `}
  }
`;

const ValidationIcon = styled.div<{ type: 'error' | 'success' }>`
  position: absolute;
  right: var(--space-3);
  top: 50%;
  transform: translateY(-50%);
  color: ${props =>
    props.type === 'error' ? 'var(--color-error)' : 'var(--color-success)'};
  font-size: var(--icon-size-base);
`;

const ValidationMessage = styled.div<{ type: 'error' | 'success' }>`
  font-size: var(--font-size-body-xs);
  color: ${props =>
    props.type === 'error' ? 'var(--color-error)' : 'var(--color-success)'};
  margin-top: var(--space-2);
  display: flex;
  align-items: center;
  gap: var(--space-1);
`;

// Usage
<StyledFormGroup>
  <StyledLabel for="bandName">Band Name</StyledLabel>
  <InputWrapper error={!!validation.error} success={!!validation.success}>
    <StyledInput
      id="bandName"
      type="text"
      value={bandName}
      onChange={handleChange}
    />
    {validation.error && (
      <ValidationIcon type="error">
        <i className="bi bi-exclamation-circle-fill"></i>
      </ValidationIcon>
    )}
    {validation.success && (
      <ValidationIcon type="success">
        <i className="bi bi-check-circle-fill"></i>
      </ValidationIcon>
    )}
  </InputWrapper>
  {validation.error && (
    <ValidationMessage type="error">
      <i className="bi bi-exclamation-circle"></i>
      {validation.error}
    </ValidationMessage>
  )}
  {validation.success && (
    <ValidationMessage type="success">
      <i className="bi bi-check-circle"></i>
      {validation.success}
    </ValidationMessage>
  )}
</StyledFormGroup>
```

---

## Navigation Examples

### Styled Navbar

```typescript
import { Navbar, NavbarBrand, Nav, NavItem, NavLink } from 'reactstrap';
import styled from 'styled-components';
import { Link, useLocation } from 'react-router-dom';

const StyledNavbar = styled(Navbar)`
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
  padding: var(--space-3) 0;
  box-shadow: var(--shadow-sm);
`;

const Brand = styled(NavbarBrand)`
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-text-primary);
  font-weight: var(--font-weight-bold);
  font-size: var(--font-size-h4);
  letter-spacing: var(--letter-spacing-tight);

  &:hover {
    color: var(--color-brand-primary);
  }
`;

const BrandIcon = styled.span`
  font-size: var(--icon-size-lg);
`;

const StyledNav = styled(Nav)`
  gap: var(--space-2);
`;

const StyledNavLink = styled(NavLink)<{ $active?: boolean }>`
  color: ${props =>
    props.$active ? 'var(--color-brand-primary)' : 'var(--color-text-secondary)'};
  font-weight: ${props =>
    props.$active ? 'var(--font-weight-medium)' : 'var(--font-weight-regular)'};
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-base);
  transition: all var(--transition-base) ease;
  position: relative;

  &:hover {
    color: var(--color-brand-primary);
    background: var(--color-bg-tertiary);
  }

  ${props => props.$active && `
    &::after {
      content: '';
      position: absolute;
      bottom: -13px;
      left: var(--space-4);
      right: var(--space-4);
      height: 2px;
      background: var(--color-brand-primary);
      border-radius: var(--radius-full);
    }
  `}
`;

// Usage
function Navigation() {
  const location = useLocation();

  return (
    <StyledNavbar expand="md" dark>
      <Container className="px-3">
        <Brand tag={Link} to="/">
          <BrandIcon>🎶</BrandIcon>
          Bandmate
        </Brand>
        <StyledNav navbar>
          <NavItem>
            <StyledNavLink
              tag={Link}
              to="/"
              $active={location.pathname === '/'}
            >
              Home
            </StyledNavLink>
          </NavItem>
          <NavItem>
            <StyledNavLink
              tag={Link}
              to="/songs"
              $active={location.pathname === '/songs'}
            >
              Songs
            </StyledNavLink>
          </NavItem>
          <NavItem>
            <StyledNavLink
              tag={Link}
              to="/about"
              $active={location.pathname === '/about'}
            >
              About
            </StyledNavLink>
          </NavItem>
        </StyledNav>
      </Container>
    </StyledNavbar>
  );
}
```

---

## Modal Examples

### Basic Modal

```typescript
import { Modal, ModalHeader, ModalBody, ModalFooter } from 'reactstrap';
import styled from 'styled-components';

const StyledModal = styled(Modal)`
  .modal-content {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-xl);
  }
`;

const StyledModalHeader = styled(ModalHeader)`
  border-bottom: 1px solid var(--color-border);
  padding: var(--space-6);

  .modal-title {
    font-size: var(--font-size-h3);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
  }

  .btn-close {
    filter: invert(1);
    opacity: 0.6;

    &:hover {
      opacity: 1;
    }
  }
`;

const StyledModalBody = styled(ModalBody)`
  padding: var(--space-6);
  color: var(--color-text-primary);
`;

const StyledModalFooter = styled(ModalFooter)`
  border-top: 1px solid var(--color-border);
  padding: var(--space-6);
  gap: var(--space-3);
`;

// Usage
<StyledModal isOpen={isOpen} toggle={toggle} centered>
  <StyledModalHeader toggle={toggle}>
    Create New Song
  </StyledModalHeader>
  <StyledModalBody>
    {/* Form content */}
  </StyledModalBody>
  <StyledModalFooter>
    <SecondaryButton onClick={toggle}>
      Cancel
    </SecondaryButton>
    <PrimaryButton onClick={handleSubmit}>
      Create Song
    </PrimaryButton>
  </StyledModalFooter>
</StyledModal>
```

---

## Badge & Label Examples

### Status Badge

```typescript
import { Badge } from 'reactstrap';
import styled from 'styled-components';

const StatusBadge = styled(Badge)<{ $variant: 'success' | 'warning' | 'error' | 'info' }>`
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  font-size: var(--font-size-body-xs);
  font-weight: var(--font-weight-medium);
  letter-spacing: var(--letter-spacing-wide);
  text-transform: uppercase;

  ${props => {
    const colors = {
      success: 'var(--color-success)',
      warning: 'var(--color-warning)',
      error: 'var(--color-error)',
      info: 'var(--color-info)',
    };
    return `
      background: ${colors[props.$variant]};
      color: white;
    `;
  }}
`;

// Usage
<StatusBadge $variant="success">Active</StatusBadge>
<StatusBadge $variant="warning">Pending</StatusBadge>
<StatusBadge $variant="error">Error</StatusBadge>
```

### Count Badge

```typescript
const CountBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 var(--space-2);
  background: var(--color-brand-primary);
  color: white;
  border-radius: var(--radius-full);
  font-size: var(--font-size-body-xs);
  font-weight: var(--font-weight-bold);
`;

// Usage
<div>
  Songs <CountBadge>{songCount}</CountBadge>
</div>
```

---

## Loading State Examples

### Skeleton Loader

```typescript
const SkeletonCard = styled.div`
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-6);
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
`;

const SkeletonTitle = styled.div`
  height: 24px;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-base);
  margin-bottom: var(--space-3);
  width: 70%;
`;

const SkeletonText = styled.div<{ width?: string }>`
  height: 16px;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-base);
  margin-bottom: var(--space-2);
  width: ${props => props.width || '100%'};
`;

// Usage
<SkeletonCard>
  <SkeletonTitle />
  <SkeletonText />
  <SkeletonText width="80%" />
  <SkeletonText width="60%" />
</SkeletonCard>
```

### Spinner

```typescript
import { Spinner } from 'reactstrap';
import styled from 'styled-components';

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-16);
  gap: var(--space-4);
`;

const LoadingText = styled.p`
  color: var(--color-text-secondary);
  font-size: var(--font-size-body-sm);
`;

const BrandSpinner = styled(Spinner)`
  width: 48px;
  height: 48px;
  border-width: 3px;
  border-color: var(--color-brand-primary);
  border-right-color: transparent;
`;

// Usage
<LoadingContainer>
  <BrandSpinner />
  <LoadingText>Loading songs...</LoadingText>
</LoadingContainer>
```

---

## Empty State Examples

### Empty Song List

```typescript
const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-16) var(--space-4);
  text-align: center;
`;

const EmptyStateIcon = styled.div`
  font-size: var(--icon-size-3xl);
  color: var(--color-text-tertiary);
  margin-bottom: var(--space-6);
  opacity: 0.5;
`;

const EmptyStateTitle = styled.h3`
  font-size: var(--font-size-h3);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0 0 var(--space-3) 0;
`;

const EmptyStateDescription = styled.p`
  font-size: var(--font-size-body);
  color: var(--color-text-secondary);
  margin: 0 0 var(--space-8) 0;
  max-width: 400px;
`;

// Usage
<EmptyState>
  <EmptyStateIcon>
    <i className="bi bi-music-note-list"></i>
  </EmptyStateIcon>
  <EmptyStateTitle>No songs yet</EmptyStateTitle>
  <EmptyStateDescription>
    Get started by creating your first song. Add lyrics, chords, and notes
    to keep your band organized.
  </EmptyStateDescription>
  <PrimaryButton onClick={handleCreateSong}>
    <i className="bi bi-plus-circle me-2"></i>
    Create Your First Song
  </PrimaryButton>
</EmptyState>
```

---

## Complete Component Examples

### Song List Component

```typescript
import React from 'react';
import { Container } from 'reactstrap';
import styled from 'styled-components';

const PageContainer = styled(Container)`
  padding: var(--space-8) var(--space-4);
`;

const PageHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-8);
  gap: var(--space-4);

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: flex-start;
  }
`;

const PageTitle = styled.h1`
  font-size: var(--font-size-h1);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin: 0;
  letter-spacing: var(--letter-spacing-tight);
`;

const SongGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--space-6);
`;

interface Song {
  id: string;
  title: string;
  artist: string;
  created_at: string;
}

interface SongListProps {
  songs: Song[];
  loading: boolean;
  onCreateSong: () => void;
  onSongClick: (songId: string) => void;
}

export function SongList({ songs, loading, onCreateSong, onSongClick }: SongListProps) {
  if (loading) {
    return (
      <PageContainer>
        <LoadingContainer>
          <BrandSpinner />
          <LoadingText>Loading songs...</LoadingText>
        </LoadingContainer>
      </PageContainer>
    );
  }

  if (songs.length === 0) {
    return (
      <PageContainer>
        <EmptyState>
          <EmptyStateIcon>
            <i className="bi bi-music-note-list"></i>
          </EmptyStateIcon>
          <EmptyStateTitle>No songs yet</EmptyStateTitle>
          <EmptyStateDescription>
            Get started by creating your first song. Add lyrics, chords, and notes
            to keep your band organized.
          </EmptyStateDescription>
          <PrimaryButton onClick={onCreateSong}>
            <i className="bi bi-plus-circle me-2"></i>
            Create Your First Song
          </PrimaryButton>
        </EmptyState>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader>
        <PageTitle>Songs</PageTitle>
        <PrimaryButton onClick={onCreateSong}>
          <i className="bi bi-plus-circle me-2"></i>
          Add Song
        </PrimaryButton>
      </PageHeader>

      <SongGrid>
        {songs.map(song => (
          <SongCard key={song.id} onClick={() => onSongClick(song.id)}>
            <CardBody>
              <SongTitle>{song.title}</SongTitle>
              <SongArtist>{song.artist}</SongArtist>
              <SongMeta>
                <span>
                  <i className="bi bi-calendar"></i>
                  {formatDate(song.created_at)}
                </span>
              </SongMeta>
            </CardBody>
          </SongCard>
        ))}
      </SongGrid>
    </PageContainer>
  );
}
```

### Band Selector Component

```typescript
import React from 'react';
import styled from 'styled-components';

const SelectorOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(10, 10, 11, 0.8);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  padding: var(--space-4);
`;

const SelectorContainer = styled.div`
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-8);
  max-width: 600px;
  width: 100%;
  box-shadow: var(--shadow-xl);
`;

const SelectorHeader = styled.div`
  text-align: center;
  margin-bottom: var(--space-8);
`;

const SelectorTitle = styled.h2`
  font-size: var(--font-size-h2);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin: 0 0 var(--space-2) 0;
`;

const SelectorDescription = styled.p`
  font-size: var(--font-size-body-sm);
  color: var(--color-text-secondary);
  margin: 0;
`;

const BandGrid = styled.div`
  display: grid;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
`;

const CreateBandButton = styled(SecondaryButton)`
  width: 100%;
  justify-content: center;
`;

interface Band {
  id: number;
  name: string;
  songCount: number;
}

interface BandSelectorProps {
  bands: Band[];
  selectedBandId?: number;
  onSelect: (band: Band) => void;
  onCreateBand: () => void;
}

export function BandSelector({
  bands,
  selectedBandId,
  onSelect,
  onCreateBand
}: BandSelectorProps) {
  return (
    <SelectorOverlay>
      <SelectorContainer>
        <SelectorHeader>
          <SelectorTitle>Select a Band</SelectorTitle>
          <SelectorDescription>
            Choose which band you want to manage
          </SelectorDescription>
        </SelectorHeader>

        <BandGrid>
          {bands.map(band => (
            <SelectionCardContainer
              key={band.id}
              selected={band.id === selectedBandId}
              onClick={() => onSelect(band)}
            >
              <CardContent>
                <CardIcon>
                  <i className="bi bi-music-note-beamed"></i>
                </CardIcon>
                <CardInfo>
                  <CardTitle>{band.name}</CardTitle>
                  <CardSubtitle>{band.songCount} songs</CardSubtitle>
                </CardInfo>
              </CardContent>
              {band.id === selectedBandId && (
                <CheckBadge>
                  <i className="bi bi-check-circle-fill"></i>
                </CheckBadge>
              )}
            </SelectionCardContainer>
          ))}
        </BandGrid>

        <CreateBandButton onClick={onCreateBand}>
          <i className="bi bi-plus-circle me-2"></i>
          Create New Band
        </CreateBandButton>
      </SelectorContainer>
    </SelectorOverlay>
  );
}
```

---

## Accessibility Checklist

When implementing components, ensure:

- [ ] All interactive elements are keyboard accessible (Tab, Enter, Space, Escape)
- [ ] Focus states are clearly visible (never remove `:focus-visible` outlines)
- [ ] Color contrast meets WCAG AA standards (4.5:1 for normal text, 3:1 for large text)
- [ ] Icon-only buttons have `aria-label` attributes
- [ ] Form inputs have associated `<label>` elements
- [ ] Loading states are announced to screen readers (`aria-live="polite"`)
- [ ] Modals trap focus and restore it on close
- [ ] Images have meaningful `alt` text
- [ ] Touch targets are minimum 44x44px
- [ ] Animations respect `prefers-reduced-motion`

---

## Next Steps

1. Import the design tokens CSS file in your main entry point
2. Start refactoring existing components using these patterns
3. Create a component library folder with reusable components
4. Test components in both light and dark themes
5. Verify accessibility with tools like axe DevTools or Lighthouse

For questions or improvements to these examples, refer to the main [style guide](style-guide.md) or open an issue.
