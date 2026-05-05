import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import * as cheerio from 'cheerio';

async function extractStreamFromPlayer(url: string, referer: string, depth = 0): Promise<{ streamUrl: string | null, servers: any[], referer: string }> {
  if (depth > 3) return { streamUrl: url, servers: [], referer };
  
  try {
    const playerRes = await axios.get(url, {
      timeout: 3500,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)",
        "Referer": referer,
      },
      validateStatus: () => true
    });
    
    if (playerRes.status >= 400) {
      return { streamUrl: url, servers: [], referer: url };
    }

    const player$ = cheerio.load(playerRes.data);
    const container = player$('.aplr-player-container');
    
    // Extract servers
    const servers: {name: string, url: string}[] = [];
    player$('.aplr-menu a').each((i, el) => {
      let serverUrl = player$(el).attr('href');
      const name = player$(el).text().trim();
      if (serverUrl) {
        if (!serverUrl.startsWith('http')) {
           const baseUrl = new URL(url);
           serverUrl = new URL(serverUrl, baseUrl.origin + baseUrl.pathname).toString();
        }
        servers.push({ name: name || `Server ${i+1}`, url: serverUrl });
      }
    });
    
    if (container.length > 0) {
      const dataSrc = container.attr('data-src');
      const dataEncoded = container.attr('data-encoded') === 'true';
      const dataDirect = container.attr('data-direct') === 'true';
      const dataDomainsStr = container.attr('data-domains');
      
      if (dataSrc) {
        let rawSrc = dataEncoded ? Buffer.from(dataSrc, 'base64').toString('utf-8') : dataSrc;
        
        if (dataDirect) {
          return { streamUrl: rawSrc, servers, referer: url };
        } else if (dataDomainsStr) {
          try {
            const domains = JSON.parse(dataDomainsStr);
            if (domains && domains.length > 0) {
              const targetDomain = domains[0];
              let n = Date.now(), v = Math.floor(n / 144e5) + Math.floor(n / 864e5 * 1.5), l = v % 7 + 6, c = 'abcdefghijklmnopqrstuvwxyz', r = '';
              for (; l--; v = Math.floor(v / 26)) r += c[v % 26];
              const m3u8Url = `https://${r}.${targetDomain}/hls/${rawSrc}/master.m3u8`;
              return { streamUrl: m3u8Url, servers, referer: url };
            }
          } catch (e) {}
        }
      }
    }
    
    const mediaSrc = player$('source').attr('src') || player$('video').attr('src');
    if (mediaSrc && mediaSrc.includes('.m3u8')) {
       return { streamUrl: mediaSrc, servers, referer: url };
    }
    
    const m3u8Match = playerRes.data.match(/(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/);
    if (m3u8Match) {
      const cleanM3u8 = m3u8Match[1].replace(/\\n/g, '').replace(/\\/g, '').trim();
      return { streamUrl: cleanM3u8, servers, referer: url };
    }
    
    let innerIframe = player$('#aplr-player-iframe').attr('src') || player$('.video-con iframe').attr('src');
    
    if (!innerIframe) {
      player$('iframe').each((i, el) => {
        const src = player$(el).attr('src');
        if (src && src.includes('livekora.vip/embed')) {
          innerIframe = src;
          return false;
        }
      });
      if(!innerIframe) {
        player$('iframe').each((i, el) => {
          const src = player$(el).attr('src');
          if (src && !src.includes('ad1.html') && !src.includes('ads') && !src.includes('banner')) {
            innerIframe = src;
            return false;
          }
        });
      }
    }

    if (innerIframe) {
      const innerResult = await extractStreamFromPlayer(innerIframe, url, depth + 1);
      if (innerResult.streamUrl && (innerResult.streamUrl.includes('.m3u8') || innerResult.streamUrl.includes('albaplayer'))) {
        return {
          streamUrl: innerResult.streamUrl,
          servers: servers.length > 0 ? servers : innerResult.servers,
          referer: innerResult.referer
        };
      } else if (innerResult.streamUrl && innerResult.streamUrl !== innerIframe) {
        return {
          streamUrl: innerResult.streamUrl,
          servers: servers.length > 0 ? servers : innerResult.servers,
          referer: innerResult.referer
        };
      }
      return { streamUrl: innerResult.streamUrl || innerIframe, servers, referer: url };
    }
    
    return { streamUrl: url, servers, referer: url };
  } catch (e: any) {
    return { streamUrl: url, servers: [], referer: url };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = req.query.url as string;
  if (!url) {
    return res.status(400).json({ success: false, error: "URL is required" });
  }

  try {
    let streamUrl: string | null = null;
    let isDirectPlayerUrl = url.includes('albaplayer') || url.includes('shootwithyalla');
    
    let html = '';
    let mainPageHeaders: any = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)",
    };
    
    if (isDirectPlayerUrl) {
      streamUrl = url;
    } else {
      const response = await axios.get(url, {
        timeout: 3500,
        headers: mainPageHeaders,
      });

      html = response.data;
      const $mainPage = cheerio.load(html);
      
      $mainPage('.srv-click-plain').each((i, el) => {
        const dataUrl = $mainPage(el).attr('data-url');
        if (dataUrl && !streamUrl) {
          streamUrl = dataUrl;
        }
      });
      
      if (!streamUrl) {
        $mainPage('iframe').each((i, el) => {
           let src = $mainPage(el).attr('src');
           if (src && !src.includes('ads') && !src.includes('banner')) {
               streamUrl = src;
               return false;
           }
        });
      }
      
      if (!streamUrl || streamUrl === 'about:blank') {
        const scriptContent = $mainPage('script').text();
        const m3u8Match = scriptContent.match(/(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/);
        if (m3u8Match) {
          streamUrl = m3u8Match[1].replace(/\\n/g, '').replace(/\\/g, '').trim();
        }
      }
    }
    
    if (streamUrl && streamUrl !== 'about:blank') {
      const result = await extractStreamFromPlayer(streamUrl, url);
      
      if (!result.streamUrl || (!result.streamUrl.includes('.m3u8') && !result.streamUrl.includes('albaplayer'))) {
          // Inner fallback
          if(html) {
             const $mainPage = cheerio.load(html);
             let foundEmbed = false;
             $mainPage('iframe').each((i, el) => {
               let src = $mainPage(el).attr('src');
               if (src && src.includes('livekora.vip/embed')) {
                   result.streamUrl = src;
                   foundEmbed = true;
                   return false;
               }
             });
             
             if(foundEmbed && result.streamUrl) {
               const innerResult = await extractStreamFromPlayer(result.streamUrl, url);
               if (innerResult.streamUrl && (innerResult.streamUrl.includes('.m3u8') || innerResult.streamUrl.includes('albaplayer'))) {
                  result.streamUrl = innerResult.streamUrl;
                  if(innerResult.servers.length > 0) result.servers = innerResult.servers;
                  result.referer = innerResult.referer;
               }
             }
          }
      }
      
      return res.status(200).json({ success: true, ...result });
    }

    return res.status(200).json({ success: true, streamUrl, referer: url });
  } catch (error: any) {
    console.error("Error scraping stream:", error.message);
    return res.status(500).json({ success: false, error: "Failed to scrape stream" });
  }
}
