import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';

async function run() {
  const res = await axios.get('https://www.okkoora.com');
  const $ = cheerio.load(res.data);
  const links: string[] = [];
  $('a').each((i, el) => {
    const href = $(el).attr('href');
    if (href && href.includes('/matches/') && !href.includes('yesterday') && !href.includes('today') && !href.includes('tomorrow')) {
      links.push(href);
    }
  });
  console.log("Found links:", links.slice(0, 5));
  
  if (links.length > 0) {
    const matchUrl = links[0].startsWith('http') ? links[0] : `https://www.okkoora.com${links[0]}`;
    console.log("Fetching match URL:", matchUrl);
    const matchRes = await axios.get(matchUrl);
    const match$ = cheerio.load(matchRes.data);
    
    let streamUrl = null;
    match$('.srv-click-plain').each((i, el) => {
      const url = match$(el).attr('data-url');
      if (url && !streamUrl) {
        streamUrl = url;
      }
    });
    console.log("Found streamUrl:", streamUrl);
    
    if (streamUrl) {
      const playerRes = await axios.get(streamUrl);
      console.log("Player HTML:");
      console.log(playerRes.data);
    }
  }
}
run();
