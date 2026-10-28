// Palette and type, recorded in docs/SPEC.md. Bold, flat, high contrast so it
// reads from two metres away on a laptop screen.

export const C = {
  stage: '#1E2BC4', // ultramarine stage behind the mascot
  stageDot: '#2B3ADB',
  ink: '#12122A',
  sun: '#FFC21A', // mascot body
  tomato: '#FF5A36', // player one
  cyan: '#22C7EE', // player two
  mint: '#3DDC97', // success
  frost: '#BFE9FF', // freeze
  white: '#FFFFFF',
  slate: '#5D6283',
  rain: '#8C93B8',
} as const;

export const PLAYER_COLORS = [C.tomato, C.cyan] as const;

export const DISPLAY_FONT = '"Bungee", "Arial Black", Impact, sans-serif';
export const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

export function font(px: number): string {
  return `${Math.round(px)}px ${DISPLAY_FONT}`;
}

export function emojiFont(px: number): string {
  return `${Math.round(px)}px ${EMOJI_FONT}`;
}
