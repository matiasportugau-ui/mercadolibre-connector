import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff7e6',
          100: '#ffecb3',
          400: '#FFE600',
          500: '#F5D900',
          600: '#D4B000',
        },
        ml: {
          yellow: '#FFE600',
          blue: '#3483FA',
        },
      },
      fontFamily: { sans: ['Inter', 'sans-serif'] },
    },
  },
  plugins: [],
};
export default config;
