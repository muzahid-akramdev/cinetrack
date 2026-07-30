import type { Config } from 'tailwindcss'

// Design tokens for CineTrack — see README "Design notes" for the reasoning.
// A film-society/marquee sensibility rather than a generic SaaS palette:
// warm paper/ink base, a marquee-gold accent used sparingly, a signature
// "ticket stamp" rating badge, display serif for titles + mono for metadata.
const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F3F1EA',
        ink: '#14181A',
        surface: '#FFFFFF',
        surfaceDark: '#1D2225',
        marquee: '#D9A441',
        velvet: '#6E2B3A',
        reel: '#3E7C7B',
        line: '#DEDACD',
        lineDark: '#2B3134',
        muted: '#8A8578',
        mutedDark: '#9AA0A0',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
