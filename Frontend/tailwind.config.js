/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand colors (Green)
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
          DEFAULT: '#16a34a',
          solid: '#16a34a',
          solid_hover: '#15803d',
          tertiary: '#15803d',
        },
        dark: {
          900: '#003e49',
          800: '#004e5a',
        },
        // Map functional colors
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          DEFAULT: '#22c55e',
        },
        warning: {
          50: '#fefce8',
          100: '#fef9c3',
          500: '#eab308',
          600: '#ca8a04',
          700: '#a16207',
          DEFAULT: '#eab308',
        },
        error: {
          50: '#fef2f2',
          100: '#fee2e2',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          primary: '#ef4444',
          DEFAULT: '#ef4444',
        },
      },
      // Semantic text colors using CSS variables for dark mode support
      textColor: {
        primary: 'rgb(var(--color-text-primary) / <alpha-value>)',
        secondary: 'rgb(var(--color-text-secondary) / <alpha-value>)',
        tertiary: 'rgb(var(--color-text-tertiary) / <alpha-value>)',
        quaternary: 'rgb(var(--color-text-quaternary) / <alpha-value>)',
        placeholder: 'rgb(var(--color-text-tertiary) / <alpha-value>)',
        disabled: 'rgb(var(--color-text-tertiary) / 0.5)',
      },
      // Semantic background colors
      backgroundColor: {
        primary: 'rgb(var(--color-bg-primary) / <alpha-value>)',
        primary_hover: 'rgb(var(--color-bg-primary-hover) / <alpha-value>)',
        primary_alt: 'rgb(var(--color-bg-primary-alt) / <alpha-value>)',
        secondary: 'rgb(var(--color-bg-secondary) / <alpha-value>)',
        tertiary: 'rgb(var(--color-bg-tertiary) / <alpha-value>)',
        active: 'rgb(var(--color-bg-active) / <alpha-value>)',
        disabled_subtle: 'rgb(var(--color-bg-tertiary) / 0.5)',
      },
      // Semantic border colors
      borderColor: {
        primary: 'rgb(var(--color-border) / <alpha-value>)',
        secondary: 'rgb(var(--color-border) / <alpha-value>)',
      },
      // Ring colors
      ringColor: {
        primary: 'rgb(var(--color-border) / <alpha-value>)',
        secondary: 'rgb(var(--color-border) / <alpha-value>)',
        brand: 'rgb(22 163 74 / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      }
    },
  },
  plugins: [],
}
