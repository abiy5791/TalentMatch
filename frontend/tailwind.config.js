/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /* Near-black neutral ramp, very slightly warm — the spine of the system. */
        ink: {
          0: '#FFFFFF',
          50: '#FAFAF9',
          100: '#F4F4F2',
          200: '#E7E6E3',
          300: '#D4D3CF',
          400: '#A8A7A3',
          500: '#78776F',
          600: '#56544C',
          700: '#34332D',
          800: '#1F1E1A',
          900: '#0A0A09',
        },
        /* Used sparingly: primary CTAs, active nav indicator, critical highlights. */
        accent: {
          50: '#FFF1EA',
          100: '#FFDDCC',
          200: '#FFB99A',
          300: '#FF9468',
          400: '#FF7D49',
          500: '#FF6B35',
          600: '#E8551F',
          700: '#BF4216',
          800: '#8C2F0E',
        },
        /* Desaturated so status colour sits calmly next to the orange accent. */
        success: { 50: '#ECF5EE', 500: '#2E7D4F', 700: '#1F5734' },
        warning: { 50: '#FBF3E1', 500: '#B57C1B', 700: '#7E5410' },
        danger: { 50: '#FBECE9', 500: '#C13B26', 700: '#8C2715' },
        info: { 50: '#ECF1F7', 500: '#3B5B86', 700: '#25395A' },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SF Mono', 'Menlo', 'monospace'],
      },
      /* Compact, dense, corporate scale — 14px body. */
      fontSize: {
        '2xs': ['11px', { lineHeight: '1.4' }],
        xs: ['12px', { lineHeight: '1.45' }],
        sm: ['13px', { lineHeight: '1.45' }],
        base: ['14px', { lineHeight: '1.45' }],
        md: ['15px', { lineHeight: '1.4' }],
        lg: ['17px', { lineHeight: '1.3' }],
        xl: ['20px', { lineHeight: '1.25' }],
        '2xl': ['24px', { lineHeight: '1.2' }],
        '3xl': ['32px', { lineHeight: '1.1' }],
        '4xl': ['40px', { lineHeight: '1.05' }],
      },
      letterSpacing: {
        tight: '-0.02em',
        snug: '-0.01em',
        eyebrow: '0.08em',
      },
      borderRadius: {
        xs: '3px',
        sm: '5px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        xs: '0 1px 0 0 rgba(10, 10, 9, 0.04)',
        sm: '0 1px 2px 0 rgba(10, 10, 9, 0.06), 0 0 0 1px rgba(10, 10, 9, 0.04)',
        md: '0 2px 4px -1px rgba(10, 10, 9, 0.08), 0 1px 2px 0 rgba(10, 10, 9, 0.06)',
        lg: '0 12px 24px -8px rgba(10, 10, 9, 0.12), 0 4px 8px -2px rgba(10, 10, 9, 0.06)',
        xl: '0 24px 48px -12px rgba(10, 10, 9, 0.18), 0 8px 16px -4px rgba(10, 10, 9, 0.08)',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      transitionDuration: {
        fast: '120ms',
        base: '180ms',
        slow: '280ms',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up': 'slide-up 180ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}
