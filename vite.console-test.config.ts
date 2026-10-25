import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
// Test-only build of the console harness (test/harness). Output is gitignored (.ui-test-build).
export default defineConfig({root:'test/harness',plugins:[react()],build:{outDir:'../../.ui-test-build/console',emptyOutDir:true,rollupOptions:{input:'test/harness/app/console.html'}}});
