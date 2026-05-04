import axios from 'axios';
import * as cheerio from 'cheerio';

async function run() {
  try {
    const res = await axios.get('https://testjojoo.s3.eu-north-1.amazonaws.com/bein1.html');
    console.log(res.data);
  } catch (e: any) {
    console.error("Failed:", e.message);
  }
}
run();
