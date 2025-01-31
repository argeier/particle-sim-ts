import restart from 'vite-plugin-restart'
import glsl from 'vite-plugin-glsl'
import { defineConfig } from 'vite'

// Define process.env for TypeScript
declare global {
    namespace NodeJS {
        interface ProcessEnv {
            SANDBOX_URL?: string
            CODESANDBOX_HOST?: string
        }
    }
}

export default defineConfig({
    root: 'src/',
    publicDir: '../static/',
    base: './',
    server: {
        host: true,
        open: !('SANDBOX_URL' in process.env || 'CODESANDBOX_HOST' in process.env)
    },
    build: {
        outDir: '../dist',
        emptyOutDir: true,
        sourcemap: true
    },
    plugins: [
        restart({ restart: ['../static/**'] }),
        glsl()
    ]
})