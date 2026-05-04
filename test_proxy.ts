import express from 'express';
import axios from 'axios';

const app = express();

app.get('/api/proxy', async (req, res) => {
  const targetUrl = req.query.url as string;
  const referer = req.query.referer as string || 'https://frfff.shootwithyalla.com/';
  
  if (!targetUrl) return res.status(400).send('URL required');
  
  try {
    const response = await axios({
      method: 'get',
      url: targetUrl,
      responseType: 'stream',
      headers: {
        'Referer': referer,
        'Origin': new URL(referer).origin,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
      }
    });
    
    // Copy headers
    Object.keys(response.headers).forEach(key => {
      if (key.toLowerCase() !== 'transfer-encoding') {
        res.setHeader(key, response.headers[key]);
      }
    });
    
    // If it's an m3u8 file, we need to rewrite the URLs inside it
    if (targetUrl.includes('.m3u8')) {
      let body = '';
      response.data.on('data', (chunk: any) => { body += chunk.toString(); });
      response.data.on('end', () => {
        const baseUrl = new URL(targetUrl);
        const rewritten = body.split('\n').map(line => {
          if (line.startsWith('#') || line.trim() === '') return line;
          // It's a URL
          let absoluteUrl = line;
          if (!line.startsWith('http')) {
            absoluteUrl = new URL(line, baseUrl.href).href;
          }
          return `/api/proxy?url=${encodeURIComponent(absoluteUrl)}&referer=${encodeURIComponent(referer)}`;
        }).join('\n');
        res.send(rewritten);
      });
    } else {
      // For .ts files, just pipe the stream
      response.data.pipe(res);
    }
  } catch (e: any) {
    console.error("Proxy error:", e.message);
    res.status(e.response?.status || 500).send(e.message);
  }
});

app.listen(3001, () => {
  console.log('Test proxy running on 3001');
});
