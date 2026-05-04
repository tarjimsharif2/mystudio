import axios from 'axios';
import * as cheerio from 'cheerio';

async function run() {
  try {
    const res = await axios.get('https://www.okkoora.com');
    const $ = cheerio.load(res.data);
    
    const matches: any[] = [];
    $('.match-container, .AY_Match').each((i, el) => {
      const team1 = $(el).find('.team1, .right-team, .TM1 .TM_Name').text().trim();
      const team2 = $(el).find('.team2, .left-team, .TM2 .TM_Name').text().trim();
      const logo1 = $(el).find('.team1 img, .right-team img, .TM1 img').attr('src') || $(el).find('.TM1 img').attr('data-src');
      const logo2 = $(el).find('.team2 img, .left-team img, .TM2 img').attr('src') || $(el).find('.TM2 img').attr('data-src');
      const time = $(el).find('.match-time, .time, .MT_Time').text().trim();
      const status = $(el).find('.match-status, .status, .MT_Status').text().trim();
      const link = $(el).find('a').attr('href') || $(el).attr('href');
      
      // Try to find date/category header
      const category = $(el).closest('.matches-date, .date-block, .AY_Matches, .match-group').prev('.date-title, h2, h3, .group-title').text().trim() || 'Today';

      matches.push({ team1, team2, logo1, logo2, time, status, link, category });
    });
    
    console.log(JSON.stringify(matches.slice(0, 5), null, 2));
    console.log("Total matches found:", matches.length);
  } catch (e: any) {
    console.error(e.message);
  }
}
run();
