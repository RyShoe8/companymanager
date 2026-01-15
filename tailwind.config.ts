import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Nucleas Brand Colors
        primary: {
          DEFAULT: '#347AF6', // Nucleus Blue
          hover: '#2D6AE5',
          light: '#E8F0FE',
          dark: '#1E4A9C',
        },
        secondary: {
          DEFAULT: '#7A57D6', // Orbital Purple
          hover: '#6B4BC7',
          light: '#F0EBFF',
          dark: '#4A3594',
        },
        accent: {
          DEFAULT: '#40C9DB', // Teal Cyan
          hover: '#36B3C4',
          light: '#E0F7FA',
          dark: '#2A8A99',
        },
        // Neutrals
        text: {
          primary: '#202637', // Charcoal Navy
          secondary: '#5E677D', // Muted Slate
        },
        border: {
          DEFAULT: '#E1E5EE', // Soft Gray
          dark: '#C5CCDB',
        },
        background: {
          DEFAULT: '#F7F8FC', // Off-White
          card: '#FFFFFF',
        },
        // Semantic Colors
        success: {
          DEFAULT: '#36B37E',
          light: '#E3F5ED',
          dark: '#2A8F63',
        },
        warning: {
          DEFAULT: '#FFAB00',
          light: '#FFF4E0',
          dark: '#CC8800',
        },
        error: {
          DEFAULT: '#DE350B',
          light: '#FCE8E4',
          dark: '#B22A09',
        },
        // Legacy support
        foreground: 'var(--foreground)',
      },
    },
  },
  plugins: [],
};

export default config;
