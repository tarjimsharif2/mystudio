import axios from 'axios';
import * as cheerio from 'cheerio';

async function run() {
  try {
    const res = await axios.get('https://www.okkoora.com/');
    const $ = cheerio.load(res.data);
    
    const matches: any[] = [];
    $('.AY_Match').each((i, el) => {
      const titleAttr = $(el).find('a').attr('title');
      const title = titleAttr || $(el).find('.team-name, .match-title, h2, h3').text().trim() || "Match " + (i + 1);
      const link = $(el).find('a').attr('href') || $(el).attr('href');
      const time = $(el).find('.match-time, .time, .MT_Time').text().trim();
      const status = $(el).find('.match-status, .status, .MT_Status').text().trim();
      const team1 = $(el).find('.team1, .right-team, .TM1 .TM_Name').text().trim();
      const team2 = $(el).find('.team2, .left-team, .TM2 .TM_Name').text().trim();
      
      if (link && link.includes('/matches/')) {
        matches.push({
          id: i,
          title: title || `${team1} vs ${team2}`,
          team1,
          team2,
          time,
          status,
          link: link.startsWith('http') ? link : `https://www.okkoora.com${link}`
        });
      }
    });
    console.log(`Found ${matches.length} match links.`);
    console.log(matches.slice(0, 5));
  } catch (e: any) {
    console.error(e.message);
  }
}
run();
