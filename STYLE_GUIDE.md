# Bandmate Style Guide

**Version 1.0** | Last Updated: November 11, 2025

---

## Table of Contents

1. [Brand Overview](#brand-overview)
2. [Color System](#color-system)
3. [Typography](#typography)
4. [Spacing & Layout](#spacing--layout)
5. [Component Patterns](#component-patterns)
6. [Iconography](#iconography)
7. [Accessibility](#accessibility)
8. [Implementation Guide](#implementation-guide)

---

## Brand Overview

### Brand Personality

Bandmate is the professional musician's digital companion—a tool that understands the workflow of serious performers while remaining approachable for casual musicians. The brand embodies:

**Core Values:**
- **Professional yet Approachable** - Serious enough for working musicians, friendly enough for weekend bands
- **Music-First** - Every design decision supports the creative process
- **Collaborative** - Built for teams, designed for seamless coordination
- **Reliable** - Dependable tools that work when you need them most

**Design Philosophy:**
- Clean, distraction-free interfaces that let musicians focus on music
- Confident use of space and hierarchy
- Subtle sophistication over flashy gimmicks
- Performance-focused with instant feedback
- Dark mode as the primary design aesthetic (for stage environments)

**Voice & Tone:**
- Clear and direct, never condescending
- Knowledgeable but not pretentious
- Encouraging and supportive
- Professional without being corporate

---

## Color System

### Philosophy

The Bandmate color system is built around high contrast, excellent readability in various lighting conditions (including stage environments), and a professional music-tech aesthetic. Dark mode is the primary theme, with light mode as a carefully calibrated alternative.

### Primary Palette

#### Brand Colors

**Bandmate Purple** (Primary Brand Color)
```css
--color-brand-primary: #8B5CF6;      /* Main brand color */
--color-brand-primary-hover: #7C3AED; /* Hover state */
--color-brand-primary-active: #6D28D9; /* Active/pressed state */
--color-brand-primary-light: #A78BFA; /* Light variant */
--color-brand-primary-dark: #5B21B6;  /* Dark variant */
```

**Musical Accent** (Secondary)
```css
--color-accent-secondary: #10B981;    /* Success/active states */
--color-accent-cyan: #06B6D4;         /* Links and info */
--color-accent-amber: #F59E0B;        /* Warnings and highlights */
--color-accent-rose: #F43F5E;         /* Alerts and destructive actions */
```

#### Dark Theme (Primary)

**Surface Colors**
```css
--color-dark-bg-primary: #0A0A0B;     /* Main background */
--color-dark-bg-secondary: #18181B;   /* Cards, panels */
--color-dark-bg-tertiary: #27272A;    /* Elevated surfaces */
--color-dark-bg-elevated: #3F3F46;    /* Modals, popovers */
--color-dark-bg-hover: #52525B;       /* Hover states */
```

**Text Colors**
```css
--color-dark-text-primary: #FAFAFA;   /* Primary text (96% opacity) */
--color-dark-text-secondary: #D4D4D8; /* Secondary text (87% opacity) */
--color-dark-text-tertiary: #A1A1AA;  /* Tertiary text (60% opacity) */
--color-dark-text-disabled: #71717A;  /* Disabled text (38% opacity) */
```

**Border & Divider Colors**
```css
--color-dark-border: #3F3F46;         /* Default borders */
--color-dark-border-subtle: #27272A;  /* Subtle dividers */
--color-dark-border-strong: #52525B;  /* Emphasized borders */
```

#### Light Theme (Secondary)

**Surface Colors**
```css
--color-light-bg-primary: #FFFFFF;    /* Main background */
--color-light-bg-secondary: #F9FAFB;  /* Cards, panels */
--color-light-bg-tertiary: #F3F4F6;   /* Elevated surfaces */
--color-light-bg-elevated: #E5E7EB;   /* Modals, popovers */
--color-light-bg-hover: #D1D5DB;      /* Hover states */
```

**Text Colors**
```css
--color-light-text-primary: #18181B;  /* Primary text (87% opacity) */
--color-light-text-secondary: #3F3F46; /* Secondary text (60% opacity) */
--color-light-text-tertiary: #71717A; /* Tertiary text (38% opacity) */
--color-light-text-disabled: #A1A1AA; /* Disabled text (24% opacity) */
```

**Border & Divider Colors**
```css
--color-light-border: #E5E7EB;        /* Default borders */
--color-light-border-subtle: #F3F4F6; /* Subtle dividers */
--color-light-border-strong: #D1D5DB; /* Emphasized borders */
```

### Semantic Colors

These colors maintain consistent meaning across both themes:

```css
/* Success States */
--color-success: #10B981;
--color-success-bg-dark: #064E3B;
--color-success-bg-light: #D1FAE5;

/* Warning States */
--color-warning: #F59E0B;
--color-warning-bg-dark: #78350F;
--color-warning-bg-light: #FEF3C7;

/* Error States */
--color-error: #EF4444;
--color-error-bg-dark: #7F1D1D;
--color-error-bg-light: #FEE2E2;

/* Info States */
--color-info: #06B6D4;
--color-info-bg-dark: #164E63;
--color-info-bg-light: #CFFAFE;
```

### Gradients

**Brand Gradients** (for hero sections, CTAs, and feature highlights)

```css
--gradient-brand-primary: linear-gradient(135deg, #8B5CF6 0%, #7C3AED 50%, #6D28D9 100%);
--gradient-brand-music: linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%);
--gradient-dark-overlay: linear-gradient(180deg, rgba(10, 10, 11, 0) 0%, rgba(10, 10, 11, 0.8) 100%);
```

### Usage Guidelines

**When to Use Each Color:**

| Color | Primary Use Cases |
|-------|------------------|
| Brand Purple | Primary CTAs, active navigation, brand moments, links |
| Musical Green | Success states, confirmation, "live" indicators, active band/song |
| Cyan | Secondary actions, informational badges, collaborative features |
| Amber | Warnings, upcoming shows, attention-needed items |
| Rose | Destructive actions, errors, critical alerts |

**Contrast Requirements:**
- All text must meet WCAG AA standards (4.5:1 for normal text, 3:1 for large text)
- Interactive elements must have clear hover and focus states
- Always test color combinations in both themes

---

## Typography

### Font System

**Primary Font Family:**
```css
--font-family-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI',
                     'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans',
                     'Droid Sans', 'Helvetica Neue', sans-serif;
```

**Monospace Font Family** (for chords, lyrics, code)
```css
--font-family-mono: 'JetBrains Mono', 'Fira Code', 'Roboto Mono',
                    'Courier New', monospace;
```

**Display Font Family** (for brand moments, hero headlines)
```css
--font-family-display: 'Inter', system-ui, sans-serif;
```

### Type Scale

The type scale is based on a 1.25 ratio (major third) optimized for mobile-first design:

```css
/* Display Sizes - For hero headlines and marketing */
--font-size-display-xl: 4rem;      /* 64px - Large hero headlines */
--font-size-display-lg: 3rem;      /* 48px - Section heroes */
--font-size-display-md: 2.25rem;   /* 36px - Card heroes */

/* Heading Sizes - For content hierarchy */
--font-size-h1: 2rem;              /* 32px - Page titles */
--font-size-h2: 1.5rem;            /* 24px - Section headers */
--font-size-h3: 1.25rem;           /* 20px - Subsection headers */
--font-size-h4: 1.125rem;          /* 18px - Card titles */
--font-size-h5: 1rem;              /* 16px - Small headers */

/* Body Sizes - For content */
--font-size-body-lg: 1.125rem;     /* 18px - Emphasized body */
--font-size-body: 1rem;            /* 16px - Default body */
--font-size-body-sm: 0.875rem;     /* 14px - Secondary body */
--font-size-body-xs: 0.75rem;      /* 12px - Captions, labels */
```

### Font Weights

```css
--font-weight-regular: 400;        /* Body text */
--font-weight-medium: 500;         /* Emphasized text, buttons */
--font-weight-semibold: 600;       /* Subheadings, active states */
--font-weight-bold: 700;           /* Headings, strong emphasis */
--font-weight-extrabold: 800;      /* Display text, hero headlines */
```

### Line Heights

```css
--line-height-tight: 1.2;          /* Display text, headings */
--line-height-snug: 1.375;         /* Subheadings */
--line-height-normal: 1.5;         /* Body text */
--line-height-relaxed: 1.625;      /* Long-form content */
--line-height-loose: 2;            /* Lyrics, chords (for readability) */
```

### Letter Spacing

```css
--letter-spacing-tighter: -0.05em; /* Display text */
--letter-spacing-tight: -0.025em;  /* Headings */
--letter-spacing-normal: 0;        /* Body text */
--letter-spacing-wide: 0.025em;    /* Buttons, labels */
--letter-spacing-wider: 0.05em;    /* All caps labels */
```

### Typography Patterns

**Page Title**
```css
font-family: var(--font-family-sans);
font-size: var(--font-size-h1);
font-weight: var(--font-weight-bold);
line-height: var(--line-height-tight);
letter-spacing: var(--letter-spacing-tight);
```

**Section Header**
```css
font-family: var(--font-family-sans);
font-size: var(--font-size-h2);
font-weight: var(--font-weight-semibold);
line-height: var(--line-height-snug);
letter-spacing: var(--letter-spacing-tight);
```

**Body Text**
```css
font-family: var(--font-family-sans);
font-size: var(--font-size-body);
font-weight: var(--font-weight-regular);
line-height: var(--line-height-normal);
letter-spacing: var(--letter-spacing-normal);
```

**Button Text**
```css
font-family: var(--font-family-sans);
font-size: var(--font-size-body-sm);
font-weight: var(--font-weight-medium);
line-height: var(--line-height-tight);
letter-spacing: var(--letter-spacing-wide);
text-transform: none; /* Keep natural case */
```

**Song Lyrics/Chords**
```css
font-family: var(--font-family-mono);
font-size: var(--font-size-body);
font-weight: var(--font-weight-regular);
line-height: var(--line-height-loose);
letter-spacing: var(--letter-spacing-normal);
```

---

## Spacing & Layout

### Spacing Scale

Based on an 8px base unit for consistent rhythm:

```css
--space-0: 0;           /* 0px */
--space-1: 0.25rem;     /* 4px - Tight spacing, icon gaps */
--space-2: 0.5rem;      /* 8px - Small gaps */
--space-3: 0.75rem;     /* 12px - Compact spacing */
--space-4: 1rem;        /* 16px - Default spacing */
--space-5: 1.25rem;     /* 20px - Medium spacing */
--space-6: 1.5rem;      /* 24px - Comfortable spacing */
--space-8: 2rem;        /* 32px - Large spacing */
--space-10: 2.5rem;     /* 40px - Section spacing */
--space-12: 3rem;       /* 48px - Major section spacing */
--space-16: 4rem;       /* 64px - Hero spacing */
--space-20: 5rem;       /* 80px - Extra large spacing */
--space-24: 6rem;       /* 96px - Massive spacing */
```

### Container Widths

```css
--container-sm: 640px;   /* Mobile landscape */
--container-md: 768px;   /* Tablet */
--container-lg: 1024px;  /* Desktop */
--container-xl: 1280px;  /* Wide desktop */
--container-full: 100%;  /* Full width */
```

### Border Radius

```css
--radius-none: 0;
--radius-sm: 0.25rem;    /* 4px - Tight corners */
--radius-base: 0.5rem;   /* 8px - Default */
--radius-md: 0.75rem;    /* 12px - Cards, panels */
--radius-lg: 1rem;       /* 16px - Modals, large cards */
--radius-xl: 1.5rem;     /* 24px - Hero elements */
--radius-full: 9999px;   /* Fully rounded (pills, avatars) */
```

### Shadows

**Dark Theme Shadows**
```css
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.5);
--shadow-base: 0 2px 4px -1px rgba(0, 0, 0, 0.6),
               0 1px 2px -1px rgba(0, 0, 0, 0.5);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.7),
             0 2px 4px -1px rgba(0, 0, 0, 0.6);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.8),
             0 4px 6px -2px rgba(0, 0, 0, 0.7);
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.9),
             0 10px 10px -5px rgba(0, 0, 0, 0.8);
--shadow-glow: 0 0 20px rgba(139, 92, 246, 0.4); /* Brand glow effect */
```

**Light Theme Shadows**
```css
--shadow-light-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow-light-base: 0 1px 3px 0 rgba(0, 0, 0, 0.1),
                     0 1px 2px 0 rgba(0, 0, 0, 0.06);
--shadow-light-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1),
                   0 2px 4px -1px rgba(0, 0, 0, 0.06);
--shadow-light-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1),
                   0 4px 6px -2px rgba(0, 0, 0, 0.05);
--shadow-light-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1),
                   0 10px 10px -5px rgba(0, 0, 0, 0.04);
```

### Grid System

Bandmate uses Bootstrap 5's grid system enhanced with custom spacing:

**Breakpoints:**
```css
--breakpoint-xs: 0;
--breakpoint-sm: 576px;
--breakpoint-md: 768px;
--breakpoint-lg: 992px;
--breakpoint-xl: 1200px;
--breakpoint-xxl: 1400px;
```

**Common Layout Patterns:**
- Use `Container` with `px-3` or `px-4` for consistent horizontal padding
- Cards should have minimum 16px (space-4) internal padding
- Section spacing should be at least 48px (space-12) on mobile, 64px (space-16) on desktop
- List items should have 12px (space-3) vertical spacing for comfortable thumb targets

---

## Component Patterns

### Buttons

**Primary Button** (Main actions, CTAs)
```typescript
<Button
  color="primary"
  size="md"
  className="fw-medium"
  style={{
    backgroundColor: 'var(--color-brand-primary)',
    borderColor: 'var(--color-brand-primary)',
    borderRadius: 'var(--radius-base)',
    padding: '12px 24px',
    transition: 'all 0.2s ease'
  }}
>
  Create Song
</Button>
```

**Secondary Button** (Supporting actions)
```typescript
<Button
  outline
  color="light"
  size="md"
  className="fw-medium"
  style={{
    borderRadius: 'var(--radius-base)',
    padding: '12px 24px'
  }}
>
  Cancel
</Button>
```

**Icon Button** (Compact actions)
```typescript
<Button
  color="secondary"
  size="sm"
  style={{
    width: '40px',
    height: '40px',
    borderRadius: 'var(--radius-base)',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }}
>
  <i className="bi bi-pencil"></i>
</Button>
```

**Button States:**
- Default: Brand color with subtle shadow
- Hover: Slightly darker shade, lifted shadow
- Active: Darkest shade, inset shadow feel
- Disabled: 50% opacity, no interaction
- Loading: Show spinner, disable interaction

### Cards

**Song Card** (Primary content container)
```typescript
<StyledCard>
  <CardHeader>
    <CardTitle>Song Title</CardTitle>
    <CardSubtitle>Artist Name</CardSubtitle>
  </CardHeader>
  <CardBody>
    {/* Content */}
  </CardBody>
  <CardFooter>
    {/* Actions */}
  </CardFooter>
</StyledCard>

const StyledCard = styled(Card)`
  background: var(--color-dark-bg-secondary);
  border: 1px solid var(--color-dark-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-base);
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }
`;
```

**Band Card** (Selection card with status)
```typescript
<SelectionCard selected={isSelected}>
  <CardIcon>
    <i className="bi bi-music-note-beamed"></i>
  </CardIcon>
  <CardContent>
    <CardTitle>{band.name}</CardTitle>
    <CardMeta>{songCount} songs</CardMeta>
  </CardContent>
  {isSelected && (
    <CheckBadge>
      <i className="bi bi-check-circle-fill"></i>
    </CheckBadge>
  )}
</SelectionCard>
```

### Navigation

**Navbar** (Top navigation)
```typescript
<Navbar expand="md" dark style={{
  backgroundColor: 'var(--color-dark-bg-secondary)',
  borderBottom: '1px solid var(--color-dark-border)',
  padding: '12px 0'
}}>
  {/* Content */}
</Navbar>
```

**Active Link Styling:**
```css
.nav-link.active {
  color: var(--color-brand-primary) !important;
  font-weight: var(--font-weight-medium);
  position: relative;
}

.nav-link.active::after {
  content: '';
  position: absolute;
  bottom: -12px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--color-brand-primary);
}
```

### Forms

**Input Fields**
```typescript
<FormGroup>
  <Label for="songTitle">Song Title</Label>
  <Input
    id="songTitle"
    type="text"
    placeholder="Enter song title"
    style={{
      backgroundColor: 'var(--color-dark-bg-tertiary)',
      borderColor: 'var(--color-dark-border)',
      color: 'var(--color-dark-text-primary)',
      borderRadius: 'var(--radius-base)',
      padding: '12px 16px',
      fontSize: 'var(--font-size-body)'
    }}
  />
  <FormText>This is how it will appear in your setlists</FormText>
</FormGroup>
```

**Textarea for Lyrics/Chords**
```typescript
<Input
  type="textarea"
  rows={12}
  placeholder="Paste lyrics here..."
  style={{
    fontFamily: 'var(--font-family-mono)',
    fontSize: 'var(--font-size-body)',
    lineHeight: 'var(--line-height-loose)',
    backgroundColor: 'var(--color-dark-bg-tertiary)',
    borderColor: 'var(--color-dark-border)',
    color: 'var(--color-dark-text-primary)',
    borderRadius: 'var(--radius-base)',
    padding: '16px'
  }}
/>
```

### Badges & Labels

**Status Badge**
```typescript
<Badge
  color="success"
  style={{
    padding: '4px 12px',
    borderRadius: 'var(--radius-full)',
    fontSize: 'var(--font-size-body-xs)',
    fontWeight: 'var(--font-weight-medium)',
    letterSpacing: 'var(--letter-spacing-wide)',
    textTransform: 'uppercase'
  }}
>
  Active
</Badge>
```

**Count Badge** (for song counts, notifications)
```typescript
<CountBadge>
  {count}
</CountBadge>

const CountBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 8px;
  background: var(--color-brand-primary);
  color: white;
  border-radius: var(--radius-full);
  font-size: var(--font-size-body-xs);
  font-weight: var(--font-weight-bold);
`;
```

### Modals & Overlays

**Modal Pattern**
```typescript
<Modal
  isOpen={isOpen}
  toggle={toggle}
  centered
  style={{
    maxWidth: '500px'
  }}
>
  <ModalHeader toggle={toggle}>
    Create New Band
  </ModalHeader>
  <ModalBody>
    {/* Form content */}
  </ModalBody>
  <ModalFooter>
    <Button color="secondary" outline onClick={toggle}>
      Cancel
    </Button>
    <Button color="primary" onClick={handleSubmit}>
      Create Band
    </Button>
  </ModalFooter>
</Modal>
```

### Loading States

**Skeleton Loader**
```typescript
<SkeletonCard>
  <SkeletonTitle />
  <SkeletonText />
  <SkeletonText width="60%" />
</SkeletonCard>

const SkeletonCard = styled.div`
  background: var(--color-dark-bg-secondary);
  border-radius: var(--radius-md);
  padding: var(--space-6);
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
`;
```

**Spinner**
```typescript
<Spinner
  color="primary"
  style={{
    width: '40px',
    height: '40px',
    borderWidth: '3px'
  }}
/>
```

### Empty States

**No Content Pattern**
```typescript
<EmptyState>
  <EmptyStateIcon>
    <i className="bi bi-music-note-list"></i>
  </EmptyStateIcon>
  <EmptyStateTitle>No songs yet</EmptyStateTitle>
  <EmptyStateDescription>
    Get started by creating your first song
  </EmptyStateDescription>
  <Button color="primary" onClick={handleCreate}>
    <i className="bi bi-plus-circle me-2"></i>
    Create Song
  </Button>
</EmptyState>

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-16) var(--space-4);
  text-align: center;
`;

const EmptyStateIcon = styled.div`
  font-size: 64px;
  color: var(--color-dark-text-tertiary);
  margin-bottom: var(--space-6);
`;
```

---

## Iconography

### Icon System

Bandmate uses **Bootstrap Icons** for a consistent, professional icon system.

**Installation:**
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css">
```

### Core Icons

| Context | Icon | Class |
|---------|------|-------|
| Songs | Music note list | `bi-music-note-list` |
| Single Song | Music note beamed | `bi-music-note-beamed` |
| Bands | People | `bi-people` |
| Add/Create | Plus circle | `bi-plus-circle` |
| Edit | Pencil | `bi-pencil` |
| Delete | Trash | `bi-trash` |
| Save | Check circle | `bi-check-circle` |
| Cancel | X circle | `bi-x-circle` |
| Settings | Gear | `bi-gear` |
| Search | Search | `bi-search` |
| Filter | Funnel | `bi-funnel` |
| Sort | Sort down | `bi-sort-down` |
| Play | Play circle | `bi-play-circle` |
| Pause | Pause circle | `bi-pause-circle` |
| Star/Favorite | Star fill | `bi-star-fill` |
| Calendar/Show | Calendar event | `bi-calendar-event` |
| Switch | Arrow left-right | `bi-arrow-left-right` |
| Theme toggle (dark) | Sun fill | `bi-sun-fill` |
| Theme toggle (light) | Moon fill | `bi-moon-fill` |
| Menu | List | `bi-list` |
| Close | X | `bi-x` |
| Back | Arrow left | `bi-arrow-left` |
| Forward | Arrow right | `bi-arrow-right` |
| Upload | Cloud upload | `bi-cloud-upload` |
| Download | Download | `bi-download` |
| Share | Share | `bi-share` |
| More options | Three dots | `bi-three-dots` |

### Icon Sizes

```css
--icon-size-xs: 12px;
--icon-size-sm: 16px;
--icon-size-base: 20px;
--icon-size-lg: 24px;
--icon-size-xl: 32px;
--icon-size-2xl: 48px;
--icon-size-3xl: 64px;
```

### Usage Guidelines

**Icon with Text:**
```typescript
<Button>
  <i className="bi bi-plus-circle me-2"></i>
  Create Song
</Button>
```

**Icon Button:**
```typescript
<IconButton aria-label="Edit song">
  <i className="bi bi-pencil"></i>
</IconButton>
```

**Large Feature Icon:**
```typescript
<FeatureIcon>
  <i className="bi bi-music-note-list"></i>
</FeatureIcon>

const FeatureIcon = styled.div`
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gradient-brand-primary);
  border-radius: var(--radius-lg);
  color: white;
  font-size: var(--icon-size-2xl);
`;
```

---

## Accessibility

### WCAG Compliance

Bandmate targets **WCAG 2.1 Level AA** compliance for all interfaces.

### Color Contrast

**Minimum Contrast Ratios:**
- Normal text: 4.5:1
- Large text (18px+): 3:1
- UI components and graphics: 3:1

**Testing:**
Use tools like WebAIM Contrast Checker to verify all text and interactive elements meet requirements.

### Keyboard Navigation

**Required Patterns:**
- All interactive elements must be keyboard accessible
- Logical tab order following visual flow
- Visible focus indicators (never remove outlines without replacement)
- Escape key closes modals and overlays
- Enter/Space activates buttons and controls

**Focus Styles:**
```css
:focus-visible {
  outline: 2px solid var(--color-brand-primary);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}
```

### Screen Reader Support

**Best Practices:**
- Use semantic HTML (`<nav>`, `<main>`, `<article>`, etc.)
- Provide `aria-label` for icon-only buttons
- Use `aria-live` regions for dynamic content updates
- Mark up forms with proper `<label>` associations
- Provide alt text for all images

**Example:**
```typescript
<Button aria-label="Switch to different band">
  <i className="bi bi-arrow-left-right" aria-hidden="true"></i>
</Button>
```

### Motion & Animation

**Respect User Preferences:**
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Touch Targets

**Minimum Sizes:**
- Buttons: 44x44px minimum (48x48px preferred)
- Links in body text: natural size with adequate padding
- Icon buttons: 40x40px minimum
- List items: 48px minimum height

---

## Implementation Guide

### Setup Theme in Styled Components

**Create theme.ts:**
```typescript
export const theme = {
  // Colors - Dark Theme (Primary)
  colors: {
    dark: {
      bg: {
        primary: '#0A0A0B',
        secondary: '#18181B',
        tertiary: '#27272A',
        elevated: '#3F3F46',
        hover: '#52525B',
      },
      text: {
        primary: '#FAFAFA',
        secondary: '#D4D4D8',
        tertiary: '#A1A1AA',
        disabled: '#71717A',
      },
      border: {
        default: '#3F3F46',
        subtle: '#27272A',
        strong: '#52525B',
      },
    },
    light: {
      bg: {
        primary: '#FFFFFF',
        secondary: '#F9FAFB',
        tertiary: '#F3F4F6',
        elevated: '#E5E7EB',
        hover: '#D1D5DB',
      },
      text: {
        primary: '#18181B',
        secondary: '#3F3F46',
        tertiary: '#71717A',
        disabled: '#A1A1AA',
      },
      border: {
        default: '#E5E7EB',
        subtle: '#F3F4F6',
        strong: '#D1D5DB',
      },
    },
    brand: {
      primary: '#8B5CF6',
      primaryHover: '#7C3AED',
      primaryActive: '#6D28D9',
      primaryLight: '#A78BFA',
      primaryDark: '#5B21B6',
    },
    accent: {
      secondary: '#10B981',
      cyan: '#06B6D4',
      amber: '#F59E0B',
      rose: '#F43F5E',
    },
    semantic: {
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
      info: '#06B6D4',
    },
  },

  // Typography
  fonts: {
    sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', 'Roboto Mono', monospace",
    display: "'Inter', system-ui, sans-serif",
  },

  fontSizes: {
    displayXl: '4rem',
    displayLg: '3rem',
    displayMd: '2.25rem',
    h1: '2rem',
    h2: '1.5rem',
    h3: '1.25rem',
    h4: '1.125rem',
    h5: '1rem',
    bodyLg: '1.125rem',
    body: '1rem',
    bodySm: '0.875rem',
    bodyXs: '0.75rem',
  },

  fontWeights: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },

  lineHeights: {
    tight: 1.2,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },

  // Spacing
  space: {
    0: '0',
    1: '0.25rem',
    2: '0.5rem',
    3: '0.75rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.5rem',
    8: '2rem',
    10: '2.5rem',
    12: '3rem',
    16: '4rem',
    20: '5rem',
    24: '6rem',
  },

  // Radius
  radius: {
    none: '0',
    sm: '0.25rem',
    base: '0.5rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.5rem',
    full: '9999px',
  },

  // Shadows
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.5)',
    base: '0 2px 4px -1px rgba(0, 0, 0, 0.6), 0 1px 2px -1px rgba(0, 0, 0, 0.5)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.7), 0 2px 4px -1px rgba(0, 0, 0, 0.6)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.8), 0 4px 6px -2px rgba(0, 0, 0, 0.7)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.9), 0 10px 10px -5px rgba(0, 0, 0, 0.8)',
    glow: '0 0 20px rgba(139, 92, 246, 0.4)',
  },

  shadowsLight: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  },

  // Breakpoints
  breakpoints: {
    xs: '0',
    sm: '576px',
    md: '768px',
    lg: '992px',
    xl: '1200px',
    xxl: '1400px',
  },
};

export type Theme = typeof theme;
```

### Using Theme in Components

**Wrap app with ThemeProvider:**
```typescript
import { ThemeProvider } from 'styled-components';
import { theme } from './theme';

function App() {
  const [mode, setMode] = useState<'light' | 'dark'>('dark');

  return (
    <ThemeProvider theme={{ ...theme, mode }}>
      {/* Your app */}
    </ThemeProvider>
  );
}
```

**Access theme in styled components:**
```typescript
import styled from 'styled-components';

const Card = styled.div`
  background: ${props => props.theme.mode === 'dark'
    ? props.theme.colors.dark.bg.secondary
    : props.theme.colors.light.bg.secondary};
  border: 1px solid ${props => props.theme.mode === 'dark'
    ? props.theme.colors.dark.border.default
    : props.theme.colors.light.border.default};
  border-radius: ${props => props.theme.radius.md};
  padding: ${props => props.theme.space[6]};
  box-shadow: ${props => props.theme.mode === 'dark'
    ? props.theme.shadows.base
    : props.theme.shadowsLight.base};
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: ${props => props.theme.mode === 'dark'
      ? props.theme.shadows.md
      : props.theme.shadowsLight.md};
  }
`;
```

### Bootstrap Integration

**Override Bootstrap variables (optional):**
```scss
// custom-bootstrap.scss
$primary: #8B5CF6;
$secondary: #10B981;
$dark: #18181B;
$light: #F9FAFB;
$body-bg: #0A0A0B;
$body-color: #FAFAFA;
$border-radius: 0.5rem;
$border-radius-lg: 0.75rem;

@import 'bootstrap/scss/bootstrap';
```

**Apply custom styles to Bootstrap components:**
```typescript
import styled from 'styled-components';
import { Button as BSButton } from 'reactstrap';

export const Button = styled(BSButton)`
  font-weight: ${props => props.theme.fontWeights.medium};
  border-radius: ${props => props.theme.radius.base};
  padding: ${props => props.theme.space[3]} ${props => props.theme.space[6]};
  letter-spacing: 0.025em;
  transition: all 0.2s ease;

  &.btn-primary {
    background: ${props => props.theme.colors.brand.primary};
    border-color: ${props => props.theme.colors.brand.primary};

    &:hover {
      background: ${props => props.theme.colors.brand.primaryHover};
      border-color: ${props => props.theme.colors.brand.primaryHover};
      transform: translateY(-1px);
    }

    &:active {
      background: ${props => props.theme.colors.brand.primaryActive};
      border-color: ${props => props.theme.colors.brand.primaryActive};
    }
  }
`;
```

### CSS Custom Properties Alternative

For simpler integration, define CSS custom properties:

```css
/* global.css */
:root {
  /* Brand Colors */
  --color-brand-primary: #8B5CF6;
  --color-brand-primary-hover: #7C3AED;
  --color-accent-secondary: #10B981;

  /* Dark Theme */
  --color-bg-primary: #0A0A0B;
  --color-bg-secondary: #18181B;
  --color-text-primary: #FAFAFA;
  --color-text-secondary: #D4D4D8;
  --color-border: #3F3F46;

  /* Typography */
  --font-sans: 'Inter', -apple-system, sans-serif;
  --font-size-body: 1rem;
  --font-weight-medium: 500;

  /* Spacing */
  --space-4: 1rem;
  --space-6: 1.5rem;

  /* Border Radius */
  --radius-base: 0.5rem;
  --radius-md: 0.75rem;

  /* Shadows */
  --shadow-base: 0 2px 4px -1px rgba(0, 0, 0, 0.6);
}

[data-bs-theme="light"] {
  --color-bg-primary: #FFFFFF;
  --color-bg-secondary: #F9FAFB;
  --color-text-primary: #18181B;
  --color-text-secondary: #3F3F46;
  --color-border: #E5E7EB;
  --shadow-base: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
}
```

---

## Quick Reference

### Component Checklist

When creating a new component, ensure it includes:

- [ ] Default state
- [ ] Hover state (for interactive elements)
- [ ] Focus state (keyboard navigation)
- [ ] Active/pressed state
- [ ] Disabled state
- [ ] Loading state (if applicable)
- [ ] Error state (if applicable)
- [ ] Empty state (for lists/collections)
- [ ] Dark mode styling
- [ ] Light mode styling
- [ ] Responsive behavior
- [ ] Accessibility attributes
- [ ] Proper semantic HTML

### Design Review Checklist

Before finalizing a design:

- [ ] Meets WCAG AA contrast requirements
- [ ] All text is readable at minimum size
- [ ] Touch targets meet 44x44px minimum
- [ ] Keyboard navigation works logically
- [ ] Focus indicators are visible
- [ ] Loading states are clear
- [ ] Error messages are helpful
- [ ] Empty states are encouraging
- [ ] Works on mobile (320px width)
- [ ] Works on desktop (1920px width)
- [ ] Animations respect prefers-reduced-motion
- [ ] Component reuses existing patterns

---

## Logo & Branding Assets

### Logo Concept

The Bandmate logo combines a music note with a connection/team element, representing both the musical focus and collaborative nature of the app.

**Logo Direction:**
- Wordmark: "Bandmate" in Inter Bold or custom typography
- Symbol: Stylized music note with subtle connection lines or nodes
- Color: Primary brand purple (#8B5CF6) on dark backgrounds, dark navy on light backgrounds
- Icon-only version: Music note symbol for app icons and favicons

**Logo Spacing:**
- Maintain clear space around logo equal to the height of the music note
- Never place logo on busy backgrounds without proper contrast

**Logo Usage:**
```typescript
// Navbar
<NavbarBrand>
  <LogoIcon>🎶</LogoIcon> {/* Replace with actual logo */}
  <LogoText>Bandmate</LogoText>
</NavbarBrand>

const LogoIcon = styled.span`
  font-size: 24px;
  margin-right: ${props => props.theme.space[2]};
`;

const LogoText = styled.span`
  font-family: ${props => props.theme.fonts.display};
  font-size: ${props => props.theme.fontSizes.h4};
  font-weight: ${props => props.theme.fontWeights.bold};
  letter-spacing: -0.025em;
`;
```

---

## Conclusion

This style guide is a living document that will evolve with Bandmate. When in doubt, prioritize:

1. **User needs** over visual flair
2. **Accessibility** over aesthetics
3. **Consistency** over novelty
4. **Performance** over complexity
5. **Clarity** over cleverness

For questions or suggestions about the style guide, open an issue or reach out to the design team.

---

**Document Version:** 1.0
**Last Updated:** November 11, 2025
**Maintained By:** Bandmate Design Team
