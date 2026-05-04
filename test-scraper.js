import axios from 'axios';

async function test() {
  const matchesRes = await axios.get('http://localhost:3000/api/matches');
  
  // just test up to 5 matches
  for (const match of matchesRes.data.matches.slice(0, 5)) {
    console.log("---");
    console.log("Testing match:", match.title);
    
    const streamRes = await axios.get(`http://localhost:3000/api/match-stream?url=${encodeURIComponent(match.link)}`);
    
    for (const server of streamRes.data.servers) {
       let sRes;
       try {
         sRes = await axios.get(`http://localhost:3000/api/match-stream?url=${encodeURIComponent(server.url)}`);
         console.log("Result for", server.name, sRes.data.streamUrl);
       } catch (e) {
         console.error("Error for", server.name);
       }
    }
  }
}

test();
