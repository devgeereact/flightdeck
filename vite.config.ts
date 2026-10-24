import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({plugins:[react(),VitePWA({registerType:'prompt',includeAssets:['icon.svg'],manifest:{name:'Flightdeck — Your journey, in view',short_name:'Flightdeck',description:'Flight updates, airport details and destination inspiration.',theme_color:'#133c35',background_color:'#f6f7f4',display:'standalone',icons:[{src:'/icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any'}]},workbox:{navigateFallbackDenylist:[/^\/api/],runtimeCaching:[{urlPattern:/\/api\//,handler:'NetworkOnly'}]}})],server:{port:5173,strictPort:true,proxy:{'/api':'http://127.0.0.1:3001'}}});
