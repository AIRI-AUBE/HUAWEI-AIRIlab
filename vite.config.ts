import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
export default defineConfig({
    plugins: [
        react(),
        {
            name: 'local-responsive-preview',
            apply: 'serve',
            configureServer(server) {
                server.middlewares.use('/__responsive', (_request, response) => {
                    response.setHeader('Content-Type', 'text/html; charset=utf-8');
                    response.end(
                        readFileSync(
                            new URL('./tools/responsive-preview.html', import.meta.url),
                            'utf8',
                        ),
                    );
                });
            },
        },
    ],
});
