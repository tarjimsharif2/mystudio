import axios from 'axios';

async function run() {
  try {
    const res = await axios.get('http://localhost:3000/api/matches');
    const matches = res.data.matches;
    console.log(`Found ${matches.length} matches.`);
    
    for (let i = 0; i < Math.min(5, matches.length); i++) {
      const match = matches[i];
      console.log(`\nChecking match: ${match.title}`);
      try {
        const streamRes = await axios.get(`http://localhost:3000/api/match-stream?url=${encodeURIComponent(match.link)}`);
        console.log(`Stream URL: ${streamRes.data.streamUrl}`);
        console.log(`Servers: ${streamRes.data.servers ? streamRes.data.servers.length : 0}`);
      } catch (e: any) {
        console.error(`Failed to get stream: ${e.message}`);
      }
    }
  } catch (e: any) {
    console.error("Failed:", e.message);
  }
}
run();
