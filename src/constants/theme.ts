/**
 * src/constants/theme.ts
 *
 * The Kenku Phrasebook visual design system.
 * All colours, typography scales, and spacing values live here.
 * Components import from this file — never use raw colour literals in JSX.
 *
 * Theme inspiration: a weathered adventurer's journal,
 * inked in candlelight with golden accents.
 */

// ---------------------------------------------------------------------------
// Colour palette
// ---------------------------------------------------------------------------

export const Colors = {
  // Backgrounds (dark parchment / dungeon)
  background:      '#0f0f1a', // Main screen background
  surface:         '#1a1a2e', // Cards, modals, pickers
  surfaceElevated: '#252540', // Elevated surfaces, tooltips
  overlay:         '#00000099', // Modal scrim

  // Primary accent — aged gold / candlelight
  gold:    '#c9a84c',
  goldDim: '#8a6f2e',
  goldBg:  '#1e1a0a', // Very subtle gold-tinted background for active items

  // Text
  textPrimary:   '#e8d5b7', // Parchment cream — body text
  textSecondary: '#9a8b7c', // Muted brown — labels, captions
  textMuted:     '#5a5060', // Very muted — placeholders, disabled
  textInverse:   '#0f0f1a', // Text on bright surfaces (e.g. a gold button)

  // Semantic
  danger:  '#cc4444', // Delete, destructive actions
  success: '#4a9e5c', // Confirmation, saved state
  info:    '#4a7eba', // Informational

  // Borders
  border:      '#2e2e4e',
  borderLight: '#3e3e5e',

  // Tab bar
  tabActive:     '#c9a84c',
  tabInactive:   '#5a5060',
  tabBackground: '#0a0a14',

  // Emotion badge colours (one per emotion value)
  emotions: {
    neutral:    '#7a7a8a',
    joy:        '#c9a84c',
    sadness:    '#4a7eba',
    anger:      '#cc4444',
    fear:       '#7a4acc',
    disgust:    '#4a9e5c',
    surprise:   '#ca7a20',
    contempt:   '#8a6f2e',
    excitement: '#cc7a44',
    confusion:  '#7a8a4a',
  } as Record<string, string>,

  // Tag colour palette — a cycle of 12 D&D-flavoured hues.
  // Used when a new tag is created without an explicit colour choice.
  tagPalette: [
    '#8B2252', // Crimson rose
    '#7B3F00', // Dragon bronze
    '#1B4F72', // Deep ocean
    '#145A32', // Forest green
    '#4A235A', // Shadow violet
    '#6E2C0E', // Rust orange
    '#1A5276', // Steel blue
    '#512E5F', // Deep purple
    '#1E8449', // Emerald
    '#935116', // Amber
    '#2E4057', // Midnight slate
    '#78281F', // Blood red
  ],
} as const;

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

export const Typography = {
  // Font families
  fontFamily: {
    // MedievalSharp is optional — falls back to system serif.
    // Load it in _layout.tsx with expo-font.
    display: 'MedievalSharp',
    body:    'System',
  },

  // Font sizes (scale in dp / sp)
  size: {
    xs:   11,
    sm:   13,
    base: 15,
    md:   17,
    lg:   20,
    xl:   24,
    xxl:  30,
    hero: 38,
  },

  // Font weights — React Native uses string literals
  weight: {
    regular: '400' as const,
    medium:  '500' as const,
    bold:    '700' as const,
  },

  // Line heights
  lineHeight: {
    tight:  1.2,
    normal: 1.5,
    loose:  1.8,
  },
} as const;

// ---------------------------------------------------------------------------
// Spacing (8-pt grid)
// ---------------------------------------------------------------------------

export const Spacing = {
  xxs: 2,
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
} as const;

// ---------------------------------------------------------------------------
// Border radius
// ---------------------------------------------------------------------------

export const Radius = {
  sm:   4,
  md:   8,
  lg:   12,
  xl:   20,
  full: 9999,
} as const;

// ---------------------------------------------------------------------------
// Shadows (cross-platform using elevation on Android, shadow* on iOS)
// ---------------------------------------------------------------------------

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
} as const;

// ---------------------------------------------------------------------------
// Animation durations (ms)
// ---------------------------------------------------------------------------

export const Duration = {
  fast:   150,
  normal: 300,
  slow:   500,
} as const;
