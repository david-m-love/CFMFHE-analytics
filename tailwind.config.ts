import type { Config } from 'tailwindcss'

// CFMFHE Analytics design system — "Baremetrics meets Linear":
// warm paper background, dark ink header, data-forward accent colors.
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        paper: '#F7F5F0',
        card: '#FFFFFF',
        ink: '#1C1B18',
        border: '#DDD9D0',
        text: {
          DEFAULT: '#1C1B18',
          2: '#5C5950',
          3: '#9C9890',
        },
        accent: {
          blue: '#3B6FA0',
          green: '#2A7A58',
          amber: '#B87020',
          red: '#B04035',
          purple: '#6B5EA8',
        },
        // Store identity colors
        cfmfhe: '#3B6FA0',
        ec: '#2A7A58',
      },
      fontFamily: {
        serif: ['var(--font-dm-serif)', 'Georgia', 'serif'],
        sans: ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-dm-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        lg: '12px',
        md: '8px',
        sm: '6px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(28,27,24,0.04), 0 1px 1px rgba(28,27,24,0.03)',
      },
    },
  },
  plugins: [],
}

export default config
