import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type BuildOptions } from 'vite';

// Cast needed so TypeScript narrows the literal type correctly
const minifier: BuildOptions['minify'] = 'esbuild';

export default defineConfig(() => ({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
    },
    server: {
        port: 3000,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
        proxy: {
            '/api': {
                target: 'http://localhost:8000',
                changeOrigin: true,
            },
        },
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    // React ecosystem
                    'react-vendor': ['react', 'react-dom', 'react-router-dom'],
                    // Charts library
                    charts: ['recharts'],
                    // Icons
                    icons: ['lucide-react'],
                },
            },
        },
        chunkSizeWarningLimit: 600,
        sourcemap: false,
        // esbuild is Vite's built-in minifier — no extra package needed.
        minify: minifier,
        esbuild: {
            drop: ['console', 'debugger'],
        },
    },
}));
