import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

const vercelApiPlugin = () => ({
  name: 'vercel-api',
  configureServer(server: any) {
    server.middlewares.use((req: any, res: any, next: any) => {
      if (req.url.startsWith('/api/')) {
        const url = req.url.split('?')[0];
        const route = url.replace('/api/', '');
        
        // Use standard node resolution or standard import for testing locally 
        import(`./api/${route}.ts`).then(module => {
          const handler = module.default;
          // Add Vercel helpers
          res.status = (code: number) => { res.statusCode = code; return res; };
          res.json = (data: any) => { 
             res.setHeader('Content-Type', 'application/json'); 
             res.end(JSON.stringify(data)); 
             return res; 
          };
          res.send = (data: any) => { res.end(data); return res; };
          
          // Parse query
          const queryUrl = req.url.split('?')[1];
          req.query = {};
          if (queryUrl) {
            const params = new URLSearchParams(queryUrl);
            params.forEach((val, key) => { req.query[key] = val; });
          }
          
          handler(req, res);
        }).catch(err => {
           console.error(err);
           res.statusCode = 500;
           res.end("API Not Found: " + err.message);
        });
        return;
      }
      next();
    });
  }
});

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), vercelApiPlugin()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
