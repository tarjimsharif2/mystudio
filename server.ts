import express from "express";
import cors from "cors";
import axios from "axios";
import * as cheerio from "cheerio";
import { createServer as createViteServer } from "vite";
import path from "path";
import translate from "google-translate-api-x";

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// In-memory cache for translations and json
let matchesCache: any = { data: null, lastFetch: 0 };
let fullJsonCache: any = { data: null, lastFetch: 0 };

// Scrape matches from okkoora.com
app.get("/api/matches", async (req, res) => {
  const now = Date.now();
  if (matchesCache.data && (now - matchesCache.lastFetch < 2 * 60 * 1000)) {
     // Return cached value if fetched within the last 2 minutes
     return res.json({ success: true, matches: matchesCache.data });
  }

  try {
    const response = await axios.get("https://www.okkoora.com", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
      },
    });

    const html = response.data;
    const $ = cheerio.load(html);
    const matches: any[] = [];
    const textsToTranslate: string[] = [];

    $('.AY_Match, .match-container, .match-event, .match-item, .live-match, .match').each((i, el) => {
      const titleAttr = $(el).find('a').attr('title');
      const title = titleAttr || $(el).find('.team-name, .match-title, h2, h3').text().trim() || "Match " + (i + 1);
      const link = $(el).find('a').attr('href') || $(el).attr('href');
      const time = $(el).find('.match-time, .time, .MT_Time').text().trim();
      const status = $(el).find('.match-status, .status, .MT_Status, .MT_Stat').text().trim();
      const team1 = $(el).find('.team1, .right-team, .TM1 .TM_Name').text().trim();
      const team2 = $(el).find('.team2, .left-team, .TM2 .TM_Name').text().trim();
      
      const logo1 = $(el).find('.TM1 img, .team1 img').attr('data-src') || $(el).find('.TM1 img, .team1 img').attr('src');
      const logo2 = $(el).find('.TM2 img, .team2 img').attr('data-src') || $(el).find('.TM2 img, .team2 img').attr('src');
      
      const category = $(el).closest('.matches-date, .date-block, .AY_Matches, .match-group').prev('.date-title, h2, h3, .group-title').text().trim() || 'Today';
      
      if (link && link.includes('/matches/')) {
        matches.push({
          id: i,
          title, team1, team2, status, category,
          logo1: logo1 && !logo1.startsWith('data:') ? logo1 : undefined,
          logo2: logo2 && !logo2.startsWith('data:') ? logo2 : undefined,
          time,
          link: link.startsWith('http') ? link : `https://www.okkoora.com${link}`
        });
        textsToTranslate.push(title, team1, team2, status, category);
      }
    });

    if (matches.length === 0) {
      $('a').each((i, el) => {
        const title = $(el).attr('title') || $(el).text().trim();
        const link = $(el).attr('href');
        
        if (link && link.includes('/matches/') && !link.includes('yesterday') && !link.includes('today') && !link.includes('tomorrow')) {
          matches.push({
            id: i,
            title: title || "Live Match",
            link: link.startsWith('http') ? link : `https://www.okkoora.com${link}`
          });
          textsToTranslate.push(title || "Live Match");
        }
      });
    }

    // Translate all Arabic texts at once
    if (textsToTranslate.length > 0) {
      try {
        const translatedArray = await translate(textsToTranslate, { to: 'en' });
        let tIndex = 0;
        
        for (let m of matches) {
           if (m.team1 !== undefined) {
             m.title = translatedArray[tIndex++].text;
             m.team1 = translatedArray[tIndex++].text;
             m.team2 = translatedArray[tIndex++].text;
             m.status = translatedArray[tIndex++].text;
             m.category = translatedArray[tIndex++].text;
           } else {
             m.title = translatedArray[tIndex++].text;
           }
        }
      } catch (err) {
         console.error("Translation API error:", err);
         // proceed with untranslated text
      }
    }

    matchesCache.data = matches;
    matchesCache.lastFetch = Date.now();

    // Trigger full json update in background if needed
    updateFullJsonCache(matches);

    res.json({ success: true, matches });
  } catch (error: any) {
    console.error("Error scraping matches:", error.message);
    res.status(500).json({ success: false, error: "Failed to scrape matches" });
  }
});

let isUpdatingJson = false;

// Helper to update full json cache in the background
async function updateFullJsonCache(matches: any[]) {
  const now = Date.now();
  if (isUpdatingJson || (now - fullJsonCache.lastFetch < 5 * 60 * 1000)) {
     return; // Already updating or cache is fresh enough (5 mins)
  }
  
  isUpdatingJson = true;
  try {
     const fullMatches = [];
     for (const match of matches) {
         try {
           const streamRes = await axios.get(`http://localhost:3000/api/match-stream?url=${encodeURIComponent(match.link)}`);
           const slug = match.title.toLowerCase()
              .replace(/\s+/g, '-')
              .replace(/[^\w\u0600-\u06FF\-]+/g, '')
              .replace(/\-\-+/g, '-')
              .replace(/^-+/, '')
              .replace(/-+$/, '');
              
           const matchFull = {
              ...match,
              slug: slug,
              player_page: `/watch/${slug}`,
              servers: streamRes.data.servers || []
           };
           fullMatches.push(matchFull);
         } catch (e) {
           const slug = match.title.toLowerCase()
              .replace(/\s+/g, '-')
              .replace(/[^\w\u0600-\u06FF\-]+/g, '')
              .replace(/\-\-+/g, '-')
              .replace(/^-+/, '')
              .replace(/-+$/, '');
              
           fullMatches.push({
             ...match,
             slug: slug,
             player_page: `/watch/${slug}`,
             servers: []
           });
         }
     }
     
     fullJsonCache.data = {
       updatedAt: new Date().toISOString(),
       matches: fullMatches
     };
     fullJsonCache.lastFetch = Date.now();
  } catch (e) {
     console.error("Error updating full JSON cache:", e);
  } finally {
     isUpdatingJson = false;
  }
}

// Global API endpoint for all matches and servers
app.get("/api/match.json", async (req, res) => {
   if (fullJsonCache.data) {
      return res.json(fullJsonCache.data);
   }
   
   // If not available yet, just trigger matches fetch and tell user to retry
   if (!matchesCache.data) {
      try {
        await axios.get(`http://localhost:${PORT}/api/matches`);
      } catch(e) {}
   } else {
      updateFullJsonCache(matchesCache.data);
   }
   
   if (fullJsonCache.data) {
       return res.json(fullJsonCache.data);
   }
   
   return res.status(503).json({ 
       status: "Processing", 
       message: "JSON is being generated for the first time. Please refresh in a few moments." 
   });
});

async function extractStreamFromPlayer(url: string, referer: string, depth = 0): Promise<{ streamUrl: string | null, servers: any[], referer: string }> {
  if (depth > 3) return { streamUrl: url, servers: [], referer };
  
  try {
    const playerRes = await axios.get(url, {
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
        "Referer": referer,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5"
      },
      validateStatus: () => true
    });
    
    if (playerRes.status >= 400) {
      console.log(`Failed to fetch player ${url}, status:`, playerRes.status);
      return { streamUrl: url, servers: [], referer };
    }

    const player$ = cheerio.load(playerRes.data);
    const container = player$('.aplr-player-container');
    
    // Extract servers
    const servers: {name: string, url: string}[] = [];
    player$('.aplr-menu a').each((i, el) => {
      let serverUrl = player$(el).attr('href');
      const name = player$(el).text().trim();
      if (serverUrl) {
        // Handle relative URLs correctly for servers
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
          } catch (e) {
            console.error("Failed to parse domains:", e);
          }
        }
      }
    }
    
    // Fallback: look for video or source tag
    const mediaSrc = player$('source').attr('src') || player$('video').attr('src');
    if (mediaSrc && mediaSrc.includes('.m3u8')) {
       return { streamUrl: mediaSrc, servers, referer: url };
    }
    
    // Fallback: look for m3u8 in entire html
    const m3u8Match = playerRes.data.match(/(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/);
    if (m3u8Match) {
      const cleanM3u8 = m3u8Match[1].replace(/\\n/g, '').replace(/\\/g, '').trim();
      return { streamUrl: cleanM3u8, servers, referer: url };
    }
    
    // Fallback: look for inner iframe
    let innerIframe = player$('#aplr-player-iframe').attr('src') || player$('.video-con iframe').attr('src');
    
    if (!innerIframe) {
      // Look for livekora specifically first
      player$('iframe').each((i, el) => {
        const src = player$(el).attr('src');
        if (src && src.includes('livekora.vip/embed')) {
          innerIframe = src;
          return false;
        }
      });
      // if still no iframe, look for any generic iframe that is likely not an ad
      if(!innerIframe) {
        player$('iframe').each((i, el) => {
          const src = player$(el).attr('src');
          if (src && !src.includes('ad1.html') && !src.includes('ads') && !src.includes('banner')) {
            innerIframe = src;
            return false; // break the each loop
          }
        });
      }
    }

    if (innerIframe) {
      // Recursively extract from inner iframe
      const innerResult = await extractStreamFromPlayer(innerIframe, url, depth + 1);
      
      // We always prefer the inner result if it has a streamURL and it's an m3u8 or an albaplayer
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
    if (e.code !== 'ECONNREFUSED' && e.code !== 'ENOTFOUND' && e.code !== 'ECONNABORTED') {
      console.error(`Error extracting from player (${url}):`, e.message || 'Unknown error');
    }
    return { streamUrl: url, servers: [], referer };
  }
}

// Scrape a specific match to get the stream/iframe URL
app.get("/api/match-stream", async (req, res) => {
  const { url } = req.query;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ success: false, error: "URL is required" });
  }

  try {
    let streamUrl = null;
    let isDirectPlayerUrl = url.includes('albaplayer') || url.includes('shootwithyalla');
    
    let $mainPage: cheerio.CheerioAPI | null = null;
    
    if (isDirectPlayerUrl) {
      streamUrl = url;
    } else {
      let mainPageHeaders: any = {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
      };
      
      const response = await axios.get(url, {
        timeout: 10000,
        headers: mainPageHeaders,
      });

      const html = response.data;
      $mainPage = cheerio.load(html);
      
      // Look for data-url in srv-click-plain elements
      $mainPage('.srv-click-plain').each((i, el) => {
        const dataUrl = $mainPage!(el).attr('data-url');
        if (dataUrl && !streamUrl) {
          streamUrl = dataUrl;
        }
      });
      
      // Look for iframe
      if (!streamUrl) {
        $mainPage('iframe').each((i, el) => {
           let src = $mainPage!(el).attr('src');
           if (src && !src.includes('ads') && !src.includes('banner')) {
               streamUrl = src;
               return false;
           }
        });
      }
    }
    
    // If we have a stream URL (like albaplayer), let's try to extract the actual m3u8
    if (streamUrl && streamUrl !== 'about:blank') {
      const result = await extractStreamFromPlayer(streamUrl, url);
      
      // Specialized fallback for livekora.vip or Similar domains that use iframes directly inside
      if (!result.streamUrl || (!result.streamUrl.includes('.m3u8') && !result.streamUrl.includes('albaplayer'))) {
        if ($mainPage) {
           let foundLivekoraEmbed = false;
           $mainPage('iframe').each((i, el) => {
             let src = $mainPage!(el).attr('src');
             if (src && src.includes('livekora.vip/embed')) {
                 result.streamUrl = src;
                 foundLivekoraEmbed = true;
                 return false;
             }
           });
           
           if(foundLivekoraEmbed) {
             const innerResult = await extractStreamFromPlayer(result.streamUrl, url);
             if (innerResult.streamUrl && (innerResult.streamUrl.includes('.m3u8') || innerResult.streamUrl.includes('albaplayer'))) {
                result.streamUrl = innerResult.streamUrl;
                if(innerResult.servers.length > 0) result.servers = innerResult.servers;
                result.referer = innerResult.referer;
             }
           }
        }
      }
      
      return res.json({ success: true, ...result });
    }

    // If no iframe, look for video tag or m3u8 in scripts of the main page
    if (!isDirectPlayerUrl && (!streamUrl || streamUrl === 'about:blank')) {
      if ($mainPage) {
        const scriptContent = $mainPage('script').text();
        const m3u8Match = scriptContent.match(/(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/);
        if (m3u8Match) {
          streamUrl = m3u8Match[1].replace(/\\n/g, '').replace(/\\/g, '').trim();
        }
      }
    }

    res.json({ success: true, streamUrl, referer: url });
  } catch (error: any) {
    console.error("Error scraping stream:", error.message);
    res.status(500).json({ success: false, error: "Failed to scrape stream" });
  }
});

// Proxy endpoint to bypass CORS and Referer restrictions for m3u8 streams
app.get("/api/proxy", async (req, res) => {
  const targetUrl = req.query.url as string;
  const referer = req.query.referer as string || 'https://frfff.shootwithyalla.com/';
  
  if (!targetUrl) return res.status(400).send('URL required');
  
  try {
    const headers: Record<string, string> = {
      'Referer': referer,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Connection': 'keep-alive'
    };

    try {
      headers['Origin'] = new URL(referer).origin;
    } catch (e) {
      // Ignore invalid referer URL
    }

    const response = await axios({
      method: 'get',
      url: targetUrl,
      responseType: 'stream',
      headers,
      validateStatus: () => true // Don't throw on error status codes
    });
    
    if (response.status >= 400) {
      console.error(`Proxy target returned status ${response.status} for ${targetUrl}`);
      // Try again without Origin header if it was a 403
      if (response.status === 403 && headers['Origin']) {
        delete headers['Origin'];
        const retryResponse = await axios({
          method: 'get',
          url: targetUrl,
          responseType: 'stream',
          headers,
          validateStatus: () => true
        });
        
        if (retryResponse.status < 400) {
          // Retry succeeded
          Object.keys(retryResponse.headers).forEach(key => {
            if (key.toLowerCase() !== 'transfer-encoding' && key.toLowerCase() !== 'access-control-allow-origin') {
              res.setHeader(key, retryResponse.headers[key]);
            }
          });
          res.setHeader('Access-Control-Allow-Origin', '*');
          
          if (targetUrl.includes('.m3u8')) {
            let body = '';
            retryResponse.data.on('data', (chunk: any) => { body += chunk.toString(); });
            retryResponse.data.on('end', () => {
              const baseUrl = new URL(targetUrl);
              const rewritten = body.split('\n').map(line => {
                if (line.startsWith('#') || line.trim() === '') return line;
                let absoluteUrl = line;
                if (!line.startsWith('http')) {
                  absoluteUrl = new URL(line, baseUrl.href).href;
                }
                return `/api/proxy?url=${encodeURIComponent(absoluteUrl)}&referer=${encodeURIComponent(referer)}`;
              }).join('\n');
              res.status(retryResponse.status).send(rewritten);
            });
            return;
          } else {
            res.status(retryResponse.status);
            retryResponse.data.pipe(res);
            return;
          }
        }
      }
      
      res.status(response.status);
      response.data.pipe(res);
      return;
    }

    // Copy headers
    Object.keys(response.headers).forEach(key => {
      if (key.toLowerCase() !== 'transfer-encoding' && key.toLowerCase() !== 'access-control-allow-origin') {
        res.setHeader(key, response.headers[key]);
      }
    });
    
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    
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

async function startServer() {
// Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
