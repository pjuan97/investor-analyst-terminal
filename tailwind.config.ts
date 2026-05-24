import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Custom colors for the terminal theme
        terminal: {
          bg: 'rgb(var(--terminal-bg) / <alpha-value>)',
          card: 'rgb(var(--terminal-card) / <alpha-value>)',
          border: 'rgb(var(--terminal-border) / <alpha-value>)',
          text: 'rgb(var(--terminal-text) / <alpha-value>)',
          muted: 'rgb(var(--terminal-muted) / <alpha-value>)',
          accent: 'rgb(var(--terminal-accent) / <alpha-value>)',
          success: 'rgb(var(--terminal-success) / <alpha-value>)',
          warning: 'rgb(var(--terminal-warning) / <alpha-value>)',
          danger: 'rgb(var(--terminal-danger) / <alpha-value>)',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
