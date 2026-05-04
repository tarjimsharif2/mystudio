import axios from 'axios';
import * as cheerio from 'cheerio';

async function test() {
  console.time('fetch');
  const response = await axios.get("http://localhost:3000/api/matches");
  const matches = response.data.matches;
  console.log(`Found ${matches.length} matches`);
  
  for (const match of matches) {
     console.log(`Getting servers for ${match.title}`);
     const streamRes = await axios.get(`http://localhost:3000/api/match-stream?url=${encodeURIComponent(match.link)}`);
     console.log(`  Found ${streamRes.data.servers?.length || 0} servers`);
  }
  console.timeEnd('fetch');
}
test();
