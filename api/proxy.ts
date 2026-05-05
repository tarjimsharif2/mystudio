import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const targetUrl = req.query.url as string;
  const referer = req.query.referer as string || 'https://frfff.shootwithyalla.com/';
  
  if (!targetUrl) return res.status(400).send('URL required');
  
  try {
    const headers: Record<string, string> = {
      'Referer': referer,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Accept': '*/* ',
    };

    try {
      headers['Origin'] = new URL(referer).origin;
    } catch (e) {}

    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers,
      validateStatus: () => true
    });
    
    if (response.status >= 400) {
      if (response.status === 403 && headers['Origin']) {
        delete headers['Origin'];
        const retryResponse = await axios.get(targetUrl, {
          responseType: 'arraybuffer',
          headers,
          validateStatus: () => true
        });
        
        if (retryResponse.status < 400) {
          Object.keys(retryResponse.headers).forEach(key => {
            if (key.toLowerCase() !== 'transfer-encoding' && key.toLowerCase() !== 'access-control-allow-origin') {
              res.setHeader(key, retryResponse.headers[key]);
            }
          });
          res.setHeader('Access-Control-Allow-Origin', '*');
          
          if (targetUrl.includes('.m3u8')) {
            const body = retryResponse.data.toString('utf-8');
            const baseUrl = new URL(targetUrl);
            const rewritten = body.split('\n').map((line: string) => {
              if (line.startsWith('#') || line.trim() === '') return line;
              let absoluteUrl = line;
              if (!line.startsWith('http')) {
                absoluteUrl = new URL(line, baseUrl.href).href;
              }
              return `/api/proxy?url=${encodeURIComponent(absoluteUrl)}&referer=${encodeURIComponent(referer)}`;
            }).join('\n');
            return res.status(retryResponse.status).send(rewritten);
          } else {
            return res.status(retryResponse.status).send(retryResponse.data);
          }
        }
      }
      
      return res.status(response.status).send(response.data);
    }

    Object.keys(response.headers).forEach(key => {
      if (key.toLowerCase() !== 'transfer-encoding' && key.toLowerCase() !== 'access-control-allow-origin') {
        res.setHeader(key, response.headers[key]);
      }
    });
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    if (targetUrl.includes('.m3u8')) {
      const body = response.data.toString('utf-8');
      const baseUrl = new URL(targetUrl);
      const rewritten = body.split('\n').map((line: string) => {
        if (line.startsWith('#') || line.trim() === '') return line;
        let absoluteUrl = line;
        if (!line.startsWith('http')) {
          absoluteUrl = new URL(line, baseUrl.href).href;
        }
        return `/api/proxy?url=${encodeURIComponent(absoluteUrl)}&referer=${encodeURIComponent(referer)}`;
      }).join('\n');
      return res.status(200).send(rewritten);
    } else {
      return res.status(200).send(response.data);
    }
  } catch (e: any) {
    return res.status(e.response?.status || 500).send(e.message);
  }
}
