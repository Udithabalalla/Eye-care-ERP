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
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        chart: {
          1: 'var(--chart-1)',
          2: 'var(--chart-2)',
          3: 'var(--chart-3)',
          4: 'var(--chart-4)',
          5: 'var(--chart-5)',
        },
        sidebar: {
          DEFAULT: 'var(--sidebar)',
          foreground: 'var(--sidebar-foreground)',
          primary: 'var(--sidebar-primary)',
          'primary-foreground': 'var(--sidebar-primary-foreground)',
          accent: 'var(--sidebar-accent)',
          'accent-foreground': 'var(--sidebar-accent-foreground)',
          border: 'var(--sidebar-border)',
          ring: 'var(--sidebar-ring)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        // Compatibility aliases mapped to shadcn tokens.
        // These keep existing classes working while still using shadcn variables.
        brand: {
          50: 'var(--accent)',
          100: 'var(--accent)',
          200: 'var(--accent)',
          300: 'var(--primary)',
          400: 'var(--primary)',
          500: 'var(--primary)',
          600: 'var(--primary)',
          700: 'var(--primary)',
          800: 'var(--primary)',
          900: 'var(--primary)',
          DEFAULT: 'var(--primary)',
        },
        success: {
          50: 'var(--accent)',
          100: 'var(--accent)',
          500: 'var(--chart-2)',
          600: 'var(--chart-2)',
          700: 'var(--chart-2)',
          DEFAULT: 'var(--chart-2)',
        },
        warning: {
          50: 'var(--accent)',
          100: 'var(--accent)',
          500: 'var(--chart-4)',
          600: 'var(--chart-4)',
          700: 'var(--chart-4)',
          DEFAULT: 'var(--chart-4)',
        },
        error: {
          50: 'var(--accent)',
          100: 'var(--accent)',
          500: 'var(--destructive)',
          600: 'var(--destructive)',
          700: 'var(--destructive)',
          DEFAULT: 'var(--destructive)',
        },
        tertiary: 'var(--muted)',
        quaternary: 'var(--muted-foreground)',
      },
      fontFamily: {
        sans: ['Figtree Variable', 'Inter', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        'xl': '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      }
    },
  },
  plugins: [],
}
