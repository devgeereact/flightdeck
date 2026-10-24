import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
// The Google Analytics Measurement ID is public by design. It reaches the page as <meta name="fd-ga-id">, which public/consent.js reads;
// with no ID there is no banner and no Google request. Static public pages get the same value from scripts/build-public.mjs.
const gaMeta=(mode:string)=>({name:'fd-ga-id',transformIndexHtml:(html:string)=>html.replace('__FD_GA_ID__',loadEnv(mode,process.cwd(),'VITE_').VITE_GA_ID||'')});
export default defineConfig(({mode})=>({plugins:[react(),gaMeta(mode),VitePWA({registerType:'prompt',includeAssets:['icon.svg'],manifest:{name:'Flightdeck — Your journey, in view',short_name:'Flightdeck',description:'Flight updates, airport details and destination inspiration.',theme_color:'#133c35',background_color:'#f6f7f4',display:'standalone',icons:[{src:'/icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any'}]},workbox:{globPatterns:['**/*.{js,css,html,woff2,svg}'],navigateFallbackDenylist:[/^\/api/,/^\/(privacy|cookies|terms|about|contact|travel-checklist|guides)(\/|$)/,/^\/(robots\.txt|sitemap\.xml|ads\.txt)$/],runtimeCaching:[{urlPattern:/\/api\//,handler:'NetworkOnly'}]}})],server:{port:5173,strictPort:true,proxy:{'/api':'http://127.0.0.1:3001'}}}));
