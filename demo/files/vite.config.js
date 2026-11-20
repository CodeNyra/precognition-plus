import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import { google } from 'laravel-vite-plugin/fonts';
import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.js'],
            refresh: true,
            fonts: [
                google('Inter', {
                    weights: [400, 500, 600],
                    variable: '--font-sans',
                    fallbacks: ['ui-sans-serif', 'system-ui', 'sans-serif'],
                }),
                google('JetBrains Mono', {
                    weights: [400, 500, 600],
                    variable: '--font-mono',
                    fallbacks: ['ui-monospace', 'monospace'],
                }),
            ],
        }),
        tailwindcss(),
        vue(),
    ],
    server: {
        watch: {
            ignored: ['**/storage/framework/views/**', '**/vendor/**'],
        },
    },
});
