import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const repositoryBase = '/wheel-of-pain-risk-lab/'

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? repositoryBase : '/',
  define: {
    __LAB_BUILD__: JSON.stringify(process.env.GITHUB_SHA ?? 'local-dev'),
  },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectRegister: false,
      manifest: {
        id: repositoryBase,
        name: 'Wheel of Pain Risk Lab',
        short_name: 'Risk Lab',
        description: 'Disposable PWA smoke tests for Wheel of Pain platform risks.',
        start_url: repositoryBase,
        scope: repositoryBase,
        display: 'standalone',
        background_color: '#0c111b',
        theme_color: '#182033',
        icons: [
          {
            src: `${repositoryBase}lab-icon.svg`,
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,json}'],
      },
    }),
  ],
}))
