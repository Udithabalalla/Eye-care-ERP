import animate from 'tailwindcss-animate'
import plugin from 'tailwindcss/plugin'

// The shadcn tokens in globals.css are complete colours (oklch(...)), so Tailwind v3
// can't apply opacity modifiers like bg-primary/10 to a bare var(--primary) and
// silently drops those classes. color-mix() lets it: <alpha-value> is 1 without a
// modifier and 0.1 for /10.
const token = (name) => `color-mix(in oklab, var(${name}) calc(<alpha-value> * 100%), transparent)`

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
        border: token('--border'),
        input: token('--input'),
        ring: token('--ring'),
        background: token('--background'),
        foreground: token('--foreground'),
        chart: {
          1: token('--chart-1'),
          2: token('--chart-2'),
          3: token('--chart-3'),
          4: token('--chart-4'),
          5: token('--chart-5'),
        },
        sidebar: {
          DEFAULT: token('--sidebar'),
          foreground: token('--sidebar-foreground'),
          primary: token('--sidebar-primary'),
          'primary-foreground': token('--sidebar-primary-foreground'),
          accent: token('--sidebar-accent'),
          'accent-foreground': token('--sidebar-accent-foreground'),
          border: token('--sidebar-border'),
          ring: token('--sidebar-ring'),
        },
        primary: {
          DEFAULT: token('--primary'),
          foreground: token('--primary-foreground'),
        },
        secondary: {
          DEFAULT: token('--secondary'),
          foreground: token('--secondary-foreground'),
        },
        destructive: {
          DEFAULT: token('--destructive'),
          foreground: token('--destructive-foreground'),
        },
        muted: {
          DEFAULT: token('--muted'),
          foreground: token('--muted-foreground'),
        },
        accent: {
          DEFAULT: token('--accent'),
          foreground: token('--accent-foreground'),
        },
        popover: {
          DEFAULT: token('--popover'),
          foreground: token('--popover-foreground'),
        },
        card: {
          DEFAULT: token('--card'),
          foreground: token('--card-foreground'),
        },
        // Status colours (globals.css): text-success, bg-warning/10, <Badge variant="info"> …
        success: {
          DEFAULT: token('--success'),
          foreground: token('--success-foreground'),
        },
        warning: {
          DEFAULT: token('--warning'),
          foreground: token('--warning-foreground'),
        },
        info: {
          DEFAULT: token('--info'),
          foreground: token('--info-foreground'),
        },
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
      },
      // Tailwind v4 scale steps that the shadcn components use. v4 accepts any multiple
      // of 0.25rem for spacing (pl-7.5, size-4.5); v3 only has the steps listed here.
      spacing: {
        4.5: '1.125rem',
        5.5: '1.375rem',
        6.5: '1.625rem',
        7.5: '1.875rem',
        8.5: '2.125rem',
        9.5: '2.375rem',
        10.5: '2.625rem',
        11.5: '2.875rem',
        13: '3.25rem',
        15: '3.75rem',
        17: '4.25rem',
        18: '4.5rem',
        19: '4.75rem',
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      },
      ringWidth: {
        3: '3px',
      },
      backdropBlur: {
        xs: '4px',
      },
      textUnderlineOffset: {
        3: '3px',
      },
      // Short and calm: things arrive quickly and never make people wait
      animationDuration: {
        DEFAULT: '180ms',
      },
      keyframes: {
        'collapsible-down': {
          from: { height: '0', opacity: '0' },
          to: { height: 'var(--radix-collapsible-content-height)', opacity: '1' },
        },
        'collapsible-up': {
          from: { height: 'var(--radix-collapsible-content-height)', opacity: '1' },
          to: { height: '0', opacity: '0' },
        },
      },
      animation: {
        'collapsible-down': 'collapsible-down 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        'collapsible-up': 'collapsible-up 150ms cubic-bezier(0.4, 0, 1, 1)',
      },
    },
  },
  plugins: [
    // Enter/exit utilities (animate-in, fade-in-0, zoom-in-95, slide-in-from-*) used by the UI components
    animate,
    // The shadcn components are written for Tailwind v4. These variants mirror the
    // @custom-variant rules in shadcn/tailwind.css (inert under v3) plus the v4 shorthands
    // the generated files use, so `npx shadcn add` output works without hand edits.
    plugin(({ addVariant, matchVariant, addUtilities }) => {
      const state = (name, value = name) => [
        `&[data-state="${value}"]`,
        `&[data-${name}]:not([data-${name}="false"])`,
      ]
      addVariant('data-open', state('open'))
      addVariant('data-closed', state('closed'))
      addVariant('data-checked', state('checked'))
      addVariant('data-unchecked', state('unchecked'))
      addVariant('data-active', state('active'))
      addVariant('data-disabled', ['&[data-disabled="true"]', '&[data-disabled]:not([data-disabled="false"])'])
      addVariant('data-selected', '&[data-selected="true"]')
      addVariant('data-horizontal', '&[data-orientation="horizontal"]')
      addVariant('data-vertical', '&[data-orientation="vertical"]')
      addVariant('data-placeholder', '&[data-placeholder]')
      addVariant('data-inset', '&[data-inset]')
      addVariant('aria-invalid', '&[aria-invalid="true"]')
      addVariant('not-data-checked', '&:not([data-state="checked"]):not([data-checked]:not([data-checked="false"]))')
      addVariant('has-aria-invalid', '&:has([aria-invalid="true"])')
      addVariant('has-aria-expanded', '&:has([aria-expanded="true"])')
      addVariant('has-disabled', '&:has(:disabled)')
      addVariant('has-data-checked', [
        '&:has([data-state="checked"])',
        '&:has([data-checked]:not([data-checked="false"]))',
      ])

      // v4 shorthands for attribute tests: has-data-[slot=x]:, in-data-[slot=x]:, not-data-[x]:
      matchVariant('has-data', (value) => `&:has([data-${value}])`)
      matchVariant('in-data', (value) => `:where([data-${value}]) &`)
      matchVariant('not-data', (value) => `&:not([data-${value}])`)
      matchVariant('not-aria', (value) => `&:not([aria-${value}])`)
      matchVariant('group-has-data', (value, { modifier }) =>
        `:merge(.group${modifier ? `\\/${modifier}` : ''}):has([data-${value}]) &`)
      // group-data-horizontal/tabs: (bare, with an optional group name)
      for (const [name, selector] of [
        ['horizontal', '[data-orientation="horizontal"]'],
        ['vertical', '[data-orientation="vertical"]'],
      ]) {
        matchVariant(
          `group-data-${name}`,
          (_, { modifier }) => `:merge(.group${modifier ? `\\/${modifier}` : ''})${selector} &`,
          { values: { DEFAULT: '' } },
        )
      }

      addUtilities({
        // Entrances decelerate, exits accelerate. Declared here (not in CSS) so variant
        // classes like data-open:animate-in pick the curve up too.
        '.animate-in': { animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' },
        '.animate-out': { animationTimingFunction: 'cubic-bezier(0.4, 0, 1, 1)', animationDuration: '140ms' },
        // v4's outline-hidden: hides the outline but keeps it in forced-colours mode
        '.outline-hidden': { outline: '2px solid transparent', outlineOffset: '2px' },
      })
    }),
  ],
}
