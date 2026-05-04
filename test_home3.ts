import axios from 'axios';
import * as cheerio from 'cheerio';

async function run() {
  try {
    const res = await axios.get('https://www.okkoora.com');
    const $ = cheerio.load(res.data);
    
    // Check how images are actually loaded (lazy loading?)
    console.log("HTML of first match:");
    console.log($('.AY_Match').first().html());
    
  } catch (e: any) {
    console.error(e.message);
  }
}
run();
