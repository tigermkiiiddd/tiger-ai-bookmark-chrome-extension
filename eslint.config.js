import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import darkModePlugin from './eslint-plugin-dark-mode/index.js';

export default tseslint.config(
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}', 'popup/**/*.{ts,tsx}', 'options/**/*.{ts,tsx}'],
    plugins: {
      'dark-mode': darkModePlugin,
    },
    rules: {
      'dark-mode/require-dark-mode': 'warn',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', '*.config.js'],
  }
);
