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
    console.log(playerRes.data);
  } catch (e: any) {
    console.error(e.message);
  }
}
run();
