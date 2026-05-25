/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./popup/**/*.{js,ts,jsx,tsx,html}",
    "./options/**/*.{js,ts,jsx,tsx,html}",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#4f46e5',
          hover: '#4338ca',
        },
        secondary: {
          DEFAULT: '#f3f4f6',
          dark: '#1f2937',
        },
        text: {
          primary: '#111827',
          secondary: '#6b7280',
          'primary-dark': '#f9fafb',
          'secondary-dark': '#9ca3af',
        },
        border: {
          DEFAULT: '#e5e7eb',
          dark: '#374151',
        },
        background: {
          DEFAULT: '#ffffff',
          dark: '#111827',
          gray: '#f9fafb',
          'gray-dark': '#1f2937',
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
  corePlugins: {
    // 禁用不必要的核心插件以减小体积
    preflight: true,
    container: false,
    accessibility: false,
    accessibility: true,
    backdropOpacity: false,
    backdropSaturate: false,
    backdropSepia: false,
    backgroundOpacity: false,
    borderOpacity: false,
    brightness: false,
    contrast: false,
    dropShadow: false,
    grayscale: false,
    hueRotate: false,
    invert: false,
    saturate: false,
    sepia: false,
    textOpacity: false,
  },
}