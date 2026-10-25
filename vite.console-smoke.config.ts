import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
// Test-only: the console harness as one script jsdom can run (test/console-smoke.mjs). Output is gitignored.
export default defineConfig({
 plugins:[react()],
 define:{'process.env.NODE_ENV':'"production"'},
 build:{rollupOptions:{output:{inlineDynamicImports:true}},outDir:'.ui-test-build/console-smoke',emptyOutDir:true,cssCodeSplit:false,minify:false,
  lib:{entry:fileURLToPath(new URL('./test/harness/app/console-harness.tsx',import.meta.url)),formats:['iife'],name:'FlightdeckConsole',fileName:()=>'console.js'}}
});
