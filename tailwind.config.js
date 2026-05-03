/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'biocare-purple': {
          50: '#f5f0fa',
          100: '#ebe0f5',
          200: '#d7c2eb',
          300: '#bc93db',
          400: '#9e5ec7',
          500: '#7B2D8B',
          600: '#6b2180',
          700: '#5a1c6b',
          800: '#4a1758',
          900: '#3d1349',
        },
        'biocare-cyan': {
          50: '#e0f7fa',
          100: '#b2ebf2',
          200: '#80deea',
          300: '#4dd0e1',
          400: '#26c6da',
          500: '#00ACC1',
          600: '#0097a7',
          700: '#00838f',
          800: '#006064',
          900: '#004d40',
        },
        'biocare-red': {
          50: '#ffebee',
          100: '#ffcdd2',
          200: '#ef9a9a',
          300: '#e57373',
          400: '#ef5350',
          500: '#D32F2F',
          600: '#c62828',
          700: '#b71c1c',
          800: '#940000',
          900: '#7f0000',
        },
        slate: {
          850: '#172032',
          950: '#0B1120',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'biocare-gradient': 'linear-gradient(135deg, #7B2D8B 0%, #00ACC1 100%)',
      },
      boxShadow: {
        'biocare': '0 4px 24px rgba(123, 45, 139, 0.25)',
        'cyan': '0 4px 24px rgba(0, 172, 193, 0.25)',
        'card': '0 2px 8px rgba(0, 0, 0, 0.3)',
        'card-hover': '0 8px 24px rgba(0, 0, 0, 0.4)',
      }
    },
  },
  plugins: [],
}
