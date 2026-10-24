import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
// Test-only build of the real app source as one script jsdom can run. Output is gitignored.
export default defineConfig({
  plugins:[react()],
  resolve:{alias:{'virtual:pwa-register':fileURLToPath(new URL('./test/pwa-stub.js',import.meta.url))}},
  define:{'process.env.NODE_ENV':'"production"','import.meta.env.VITE_CLERK_PUBLISHABLE_KEY':'""'},
  build:{rollupOptions:{output:{inlineDynamicImports:true}},outDir:'.ui-test-build',emptyOutDir:true,cssCodeSplit:false,minify:false,lib:{entry:'src/main.tsx',formats:['iife'],name:'FlightdeckApp',fileName:()=>'app.js'}}
});
