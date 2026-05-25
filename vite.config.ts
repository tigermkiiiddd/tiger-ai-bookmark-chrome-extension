import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { copyFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

/**
 * REACT USESTATE ERROR FIX DOCUMENTATION
 * =====================================
 * 
 * This configuration permanently resolves the "Cannot read properties of undefined (reading 'useState')" error
 * that occurs in Chrome extensions when React hooks are not properly bundled or loaded.
 * 
 * KEY FIXES IMPLEMENTED:
 * 
 * 1. BASE PATH CONFIGURATION:
 *    - `base: './'` ensures proper relative path resolution for extension assets
 *    - Critical for Chrome extension manifest v3 compatibility
 * 
 * 2. REACT PLUGIN CONFIGURATION:
 *    - `jsxRuntime: 'automatic'` enables automatic JSX transformation
 *    - `jsxImportSource: 'react'` explicitly sets React as the JSX source
 *    - Ensures proper React bundling and hook initialization
 * 
 * 3. MANUAL CHUNK SEPARATION:
 *    - React and ReactDOM are bundled into 'react-vendor' chunk
 *    - Prevents module loading order issues that cause useState errors
 *    - Ensures React is available before components attempt to use hooks
 * 
 * 4. EXTERNAL DEPENDENCIES:
 *    - `external: []` prevents Vite from treating React as external
 *    - Ensures React is properly bundled within the extension
 * 
 * TROUBLESHOOTING:
 * - If useState errors reappear, verify the 'react-vendor' chunk is generated
 * - Check that popup/index.html correctly references react-vendor.js
 * - Ensure all React imports use the same bundled version
 * 
 * Last Updated: 2024 - React useState Error Resolution
 */

export default defineConfig({
  base: './',
  plugins: [
    react({
      jsxRuntime: 'automatic',
      jsxImportSource: 'react'
    }),
    {
      name: 'copy-static-files',
      writeBundle() {
        try {
          console.log('正在复制静态文件...')
          
          // 确保dist目录存在
          const distDir = resolve(__dirname, 'dist')
          const iconsDistDir = join(distDir, 'icons')
          
          if (!existsSync(iconsDistDir)) {
            mkdirSync(iconsDistDir, { recursive: true })
          }
          
          // 复制manifest.json
          copyFileSync(
            resolve(__dirname, 'manifest.json'),
            join(distDir, 'manifest.json')
          )
          console.log('✓ 复制 manifest.json')
          
          // 复制icons目录
          const iconsSourceDir = resolve(__dirname, 'public/icons')
          if (existsSync(iconsSourceDir)) {
            const iconFiles = ['icon16.png', 'icon32.png', 'icon48.png', 'icon128.png']
            iconFiles.forEach(iconFile => {
              const sourcePath = join(iconsSourceDir, iconFile)
              const destPath = join(iconsDistDir, iconFile)
              if (existsSync(sourcePath)) {
                copyFileSync(sourcePath, destPath)
                console.log(`✓ 复制 ${iconFile}`)
              }
            })
          }

          // 复制 offscreen 文件
          const offscreenSourceDir = resolve(__dirname, 'src/offscreen')
          const offscreenDistDir = join(distDir, 'src/offscreen')
          if (existsSync(offscreenSourceDir)) {
            if (!existsSync(offscreenDistDir)) {
              mkdirSync(offscreenDistDir, { recursive: true })
            }
            const offscreenFiles = ['imageCompressor.html', 'imageCompressor.js']
            offscreenFiles.forEach(file => {
              const sourcePath = join(offscreenSourceDir, file)
              const destPath = join(offscreenDistDir, file)
              if (existsSync(sourcePath)) {
                copyFileSync(sourcePath, destPath)
                console.log(`✓ 复制 offscreen/${file}`)
              }
            })
          }

        } catch (error) {
          console.error('复制静态文件失败:', error)
        }
      }
    }
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    // Service Worker 无 document；禁用 Vite 的 module preload 否则会 __vite_preload → document.*
    modulePreload: false,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup/index.html'),
        options: resolve(__dirname, 'options/index.html'),
        background: resolve(__dirname, 'src/background.ts'),
        content: resolve(__dirname, 'src/content.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') return 'background.js'
          if (chunkInfo.name === 'content') return 'content.js'
          return 'assets/[name].[hash].js'
        },
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor';
            }
            if (id.includes('@google/generative-ai')) {
              return 'ai';
            }
            if (id.includes('zustand') || id.includes('date-fns') || id.includes('lru-cache')) {
              return 'utils';
            }
          }
        }
      },
      external: [],
    },
    target: 'esnext',
    minify: 'esbuild',
    esbuildOptions: {
      drop: ['console', 'debugger'],
    },
    chunkSizeWarningLimit: 1000,
  },
})