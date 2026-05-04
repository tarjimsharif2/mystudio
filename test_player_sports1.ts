import axios from 'axios';
import * as cheerio from 'cheerio';

async function run() {
  const url = 'https://frfff.shootwithyalla.com/albaplayer/sports-1/';
  try {
    const playerRes = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
        "Referer": "https://www.okkoora.com/"
      }
    });
    const player$ = cheerio.load(playerRes.data);
    const container = player$('.aplr-player-container');
    console.log("Container length:", container.length);
    
    if (container.length > 0) {
      console.log("data-src:", container.attr('data-src'));
      console.log("data-encoded:", container.attr('data-encoded'));
      console.log("data-direct:", container.attr('data-direct'));
      console.log("data-domains:", container.attr('data-domains'));
    } else {
      console.log("No container found. HTML snippet:");
      console.log(playerRes.data.substring(0, 500));
    }
  } catch (e: any) {
    console.error(e.message);
  }
}
run();
