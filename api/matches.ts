import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import * as cheerio from 'cheerio';
import translate from 'google-translate-api-x';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const response = await axios.get("https://www.okkoora.com", {
      timeout: 3500,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)",
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

    if (textsToTranslate.length > 0) {
      try {
        let timeoutId: any;
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error("Translation timed out")), 2500);
        });
        const translateTask = translate(textsToTranslate, { to: 'en' }).catch(e => {
           console.error("Background translate error:", e.message);
           throw e;
        });
        const translatedArray: any = await Promise.race([
          translateTask,
          timeoutPromise
        ]);
        clearTimeout(timeoutId);
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
      } catch (err: any) {
         console.error("Translation API error:", err.message);
      }
    }

    return res.status(200).json({ success: true, matches });
  } catch (error: any) {
    console.error("Error scraping matches:", error.message);
    return res.status(500).json({ success: false, error: "Failed to scrape matches: " + error.message });
  }
}
