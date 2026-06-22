import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Core brand - electric cyan/teal for blockchain tech feel
        brand: {
          50: '#083344',
          100: '#0c4a5e',
          200: '#0e6480',
          300: '#11789c',
          400: '#0891b2',
          500: '#06b6d4',
          600: '#22d3ee',
          700: '#67e8f9',
          800: '#a5f3fc',
          900: '#cffafe',
          950: '#ecfeff',
        },
        // Primary alias (maps to brand) - REVERSED for dark theme
        primary: {
          50: '#083344',
          100: '#0c4a5e',
          200: '#0e6480',
          300: '#11789c',
          400: '#0891b2',
          500: '#06b6d4',
          600: '#22d3ee',
          700: '#67e8f9',
          800: '#a5f3fc',
          900: '#cffafe',
          950: '#ecfeff',
        },
        // Accent - purple/violet for blockchain feel - REVERSED
        accent: {
          50: '#4c1d95',
          100: '#5b21b6',
          200: '#6d28d9',
          300: '#7c3aed',
          400: '#8b5cf6',
          500: '#a78bfa',
          600: '#c4b5fd',
          700: '#ddd6fe',
          800: '#ede9fe',
          900: '#f5f3ff',
        },
        // Surface - dark navy/slate backgrounds (already dark-theme oriented)
        surface: {
          0: '#0a0e1a',
          50: '#0f1629',
          100: '#131b33',
          200: '#1a2340',
          300: '#222d4d',
          400: '#2a3659',
          500: '#3b4a6b',
          600: '#5a6a8a',
          700: '#8494b4',
          800: '#b0bdd4',
          900: '#d4dae8',
          950: '#eef1f7',
        },
        // Success - emerald green - REVERSED
        success: {
          50: '#064e3b',
          100: '#065f46',
          200: '#047857',
          300: '#059669',
          400: '#10b981',
          500: '#34d399',
          600: '#6ee7b7',
          700: '#a7f3d0',
          800: '#d1fae5',
          900: '#ecfdf5',
        },
        // Warning - amber - REVERSED
        warning: {
          50: '#78350f',
          100: '#92400e',
          200: '#b45309',
          300: '#d97706',
          400: '#f59e0b',
          500: '#fbbf24',
          600: '#fcd34d',
          700: '#fde68a',
          800: '#fef3c7',
          900: '#fffbeb',
        },
        // Danger - red - REVERSED
        danger: {
          50: '#7f1d1d',
          100: '#991b1b',
          200: '#b91c1c',
          300: '#dc2626',
          400: '#ef4444',
          500: '#f87171',
          600: '#fca5a5',
          700: '#fecaca',
          800: '#fee2e2',
          900: '#fef2f2',
        },
        // Info - blue - REVERSED
        info: {
          50: '#1e3a8a',
          100: '#1e40af',
          200: '#1d4ed8',
          300: '#2563eb',
          400: '#3b82f6',
          500: '#60a5fa',
          600: '#93c5fd',
          700: '#bfdbfe',
          800: '#dbeafe',
          900: '#eff6ff',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'glow-sm': '0 0 15px -3px rgba(6, 182, 212, 0.15)',
        'glow': '0 0 30px -5px rgba(6, 182, 212, 0.2)',
        'glow-lg': '0 0 60px -10px rgba(6, 182, 212, 0.25)',
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px -1px rgba(0, 0, 0, 0.3)',
        'card-hover': '0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
      },
      backgroundImage: {
        'grid-pattern': 'linear-gradient(rgba(6, 182, 212, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(6, 182, 212, 0.03) 1px, transparent 1px)',
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      backgroundSize: {
        'grid': '24px 24px',
      },
      animation: {
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '1' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;