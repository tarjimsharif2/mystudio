import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import * as cheerio from 'cheerio';
import translate from 'google-translate-api-x';

const generateSlug = (text: string) => {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u0600-\u06FF\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
};

const getMatchSlug = (match: any) => {
  if (match.team1 && match.team2) {
    return generateSlug(`${match.team1} vs ${match.team2}`);
  }
  let cleanTitle = match.title.toLowerCase();
  cleanTitle = cleanTitle.replace(/match broadcast.*$/i, '');
  cleanTitle = cleanTitle.replace(/live broadcast.*$/i, '');
  return generateSlug(cleanTitle);
};

async function getMatchStreams(matchUrl: string) {
  try {
    const response = await axios.get(matchUrl, { timeout: 3500, headers: { "User-Agent": "Mozilla/5.0" } });
    const $main = cheerio.load(response.data);
    let iframeUrl = '';
    
    $main('.srv-click-plain').each((i, el) => {
      const dataUrl = $main(el).attr('data-url');
      if (dataUrl && !iframeUrl) iframeUrl = dataUrl;
    });
    if (!iframeUrl) {
      $main('iframe').each((i, el) => {
         let src = $main(el).attr('src');
         if (src && !src.includes('ads') && !src.includes('banner')) {
             iframeUrl = src;
             return false;
         }
      });
    }

    let servers: any[] = [];
    if (iframeUrl && iframeUrl !== 'about:blank') {
       try {
         const playerRes = await axios.get(iframeUrl, { timeout: 3500, headers: { "User-Agent": "Mozilla/5.0", "Referer": matchUrl } });
         const $player = cheerio.load(playerRes.data);
         $player('.aplr-menu a').each((i, el) => {
            const name = $player(el).text().trim();
            if (name) servers.push(name);
         });
       } catch(e) {}
    }
    return servers;
  } catch(e) {
    return [];
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host || 'localhost';
    const baseUrl = `${proto}://${host}`;

    const response = await axios.get("https://www.okkoora.com", {
      timeout: 8000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
      },
    });

    const html = response.data;
    const $ = cheerio.load(html);
    const rawMatches: any[] = [];
    const textsToTranslate: string[] = [];

    $('.AY_Match, .match-container, .match-event, .match-item, .live-match, .match').each((i, el) => {
      const titleAttr = $(el).find('a').attr('title');
      const title = titleAttr || $(el).find('.team-name, .match-title, h2, h3').text().trim() || "Match";
      const link = $(el).find('a').attr('href') || $(el).attr('href');
      const time = $(el).find('.match-time, .time, .MT_Time').text().trim();
      const status = $(el).find('.match-status, .status, .MT_Status, .MT_Stat').text().trim();
      const team1 = $(el).find('.team1, .right-team, .TM1 .TM_Name').text().trim();
      const team2 = $(el).find('.team2, .left-team, .TM2 .TM_Name').text().trim();
      
      const logo1 = $(el).find('.TM1 img, .team1 img').attr('data-src') || $(el).find('.TM1 img, .team1 img').attr('src');
      const logo2 = $(el).find('.TM2 img, .team2 img').attr('data-src') || $(el).find('.TM2 img, .team2 img').attr('src');
      
      const category = $(el).closest('.matches-date, .date-block, .AY_Matches, .match-group').prev('.date-title, h2, h3, .group-title').text().trim() || 'Today';
      
      if (link && link.includes('/matches/')) {
        rawMatches.push({
          id: i.toString(),
          title, team1, team2, status, category,
          logo1: logo1 && !logo1.startsWith('data:') ? logo1 : undefined,
          logo2: logo2 && !logo2.startsWith('data:') ? logo2 : undefined,
          time,
          link: link.startsWith('http') ? link : `https://www.okkoora.com${link}`
        });
        textsToTranslate.push(title, team1, team2, status, category);
      }
    });

    if (textsToTranslate.length > 0) {
      try {
        let timeoutId: any;
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error("Translation timed out")), 2000);
        });
        const translateTask = translate(textsToTranslate, { to: 'en' }).catch(() => null);
        const translatedArray: any = await Promise.race([ translateTask, timeoutPromise ]);
        clearTimeout(timeoutId);
        
        if (translatedArray) {
          let tIndex = 0;
          for (let m of rawMatches) {
             m.title = translatedArray[tIndex++].text;
             m.team1 = translatedArray[tIndex++].text;
             m.team2 = translatedArray[tIndex++].text;
             m.status = translatedArray[tIndex++].text;
             m.category = translatedArray[tIndex++].text;
          }
        }
      } catch (err: any) {}
    }

    const fetchPromises = rawMatches.map(async (m) => {
        const slug = getMatchSlug(m);
        const servers = await getMatchStreams(m.link);
        
        let playerUrl: any = `${baseUrl}/match/${slug}`;
        if (servers.length > 0) {
           playerUrl = servers.map(s => `${baseUrl}/match/${slug}/${generateSlug(s)}`);
        } else {
           playerUrl = [playerUrl]; // Wrap in array as requested
        }

        return {
           id: slug,
           name: m.title,
           league: m.category,
           time: m.time,
           status: m.status,
           image: m.logo1 || m.logo2 || "https://icons.iconarchive.com/icons/custom-icon-design/flatastic-10/512/Sport-football-icon.png",
           matchUrl: m.link,
           playerUrl,
           streamUrl: `${baseUrl}/api/proxy?url=` // Placeholder as the frontend handles stream resolution
        };
    });

    const matchesResult = await Promise.all(fetchPromises);

    return res.status(200).json({
      updatedAt: new Date().toISOString(),
      count: matchesResult.length,
      matches: matchesResult
    });
  } catch (error: any) {
    console.error("Error scraping matches:", error.message);
    return res.status(500).json({ error: "Failed to load matches" });
  }
}
