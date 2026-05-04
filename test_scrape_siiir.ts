import axios from 'axios';
import * as cheerio from 'cheerio';

async function test() {
  try {
    const res = await axios.get('https://www.okkoora.com');
    const $ = cheerio.load(res.data);
    const firstMatch = $('.match-container a, .AY_Match a').first().attr('href');
    console.log("First match:", firstMatch);
    
    if (firstMatch) {
      const url = firstMatch.startsWith('http') ? firstMatch : `https://www.okkoora.com${firstMatch}`;
      const matchRes = await axios.get(`http://localhost:3000/api/match-stream?url=${encodeURIComponent(url)}`);
      console.log("Stream result:", JSON.stringify(matchRes.data, null, 2));
    }
  } catch (e: any) {
    console.error(e.message);
  }
}
test();
