import axios from 'axios';
import * as cheerio from 'cheerio';

async function run() {
  try {
    const res = await axios.get('https://frfff.shootwithyalla.com/albaplayer/sports-3/');
    const $ = cheerio.load(res.data);
    
    const servers: any[] = [];
    $('.aplr-menu a').each((i, el) => {
      const url = $(el).attr('href');
      const name = $(el).text().trim();
      if (url) {
        servers.push({ name: name || `Server ${i+1}`, url });
      }
    });
    console.log("Servers found in player:", servers);
  } catch (e: any) {
    console.error(e.message);
  }
}
run();
