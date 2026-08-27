/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        care: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0284c7',
          600: '#0369a1',
          700: '#075985',
          800: '#0c4a6e',
          900: '#082f49',
          950: '#041f32',
        },
        canvas: {
          DEFAULT: '#f8fafc',
          muted: '#f1f5f9',
          inverse: '#0f172a',
        },
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f8fafc',
          elevated: '#ffffff',
          inverse: '#1e293b',
        },
        content: {
          DEFAULT: '#0f172a',
          muted: '#475569',
          subtle: '#64748b',
          inverse: '#ffffff',
        },
        status: {
          healthy: {
            DEFAULT: '#166534',
            surface: '#dcfce7',
            border: '#15803d',
            foreground: '#ffffff',
          },
          degraded: {
            DEFAULT: '#92400e',
            surface: '#fef3c7',
            border: '#b45309',
            foreground: '#ffffff',
          },
          critical: {
            DEFAULT: '#b91c1c',
            surface: '#fee2e2',
            border: '#b91c1c',
            foreground: '#ffffff',
          },
          recovering: {
            DEFAULT: '#075985',
            surface: '#e0f2fe',
            border: '#0369a1',
            foreground: '#ffffff',
          },
          unknown: {
            DEFAULT: '#475569',
            surface: '#e2e8f0',
            border: '#64748b',
            foreground: '#ffffff',
          },
          fallback: {
            DEFAULT: '#9a3412',
            surface: '#ffedd5',
            border: '#c2410c',
            foreground: '#ffffff',
          },
        },
        focus: {
          DEFAULT: '#0369a1',
          offset: '#ffffff',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'sans-serif',
        ],
        mono: [
          '"SFMono-Regular"',
          'Consolas',
          '"Liberation Mono"',
          'monospace',
        ],
      },
      fontSize: {
        'display-sm': ['1.875rem', { lineHeight: '2.25rem', fontWeight: '700' }],
        'display-md': ['2.25rem', { lineHeight: '2.5rem', fontWeight: '700' }],
        metric: ['2rem', { lineHeight: '2.25rem', fontWeight: '700' }],
      },
      spacing: {
        18: '4.5rem',
        22: '5.5rem',
        30: '7.5rem',
      },
      minHeight: {
        touch: '2.75rem',
      },
      minWidth: {
        touch: '2.75rem',
      },
      maxWidth: {
        dashboard: '90rem',
        prose: '70ch',
      },
      borderRadius: {
        panel: '0.75rem',
      },
      boxShadow: {
        panel: '0 1px 3px 0 rgb(15 23 42 / 0.1), 0 1px 2px -1px rgb(15 23 42 / 0.1)',
        elevated:
          '0 10px 15px -3px rgb(15 23 42 / 0.1), 0 4px 6px -4px rgb(15 23 42 / 0.1)',
        focus: '0 0 0 3px rgb(3 105 161 / 0.35)',
      },
      transitionDuration: {
        instant: '0ms',
        fast: '150ms',
        standard: '200ms',
        slow: '300ms',
      },
      transitionTimingFunction: {
        gentle: 'cubic-bezier(0.2, 0, 0, 1)',
      },
    },
  },
  plugins: [],
};