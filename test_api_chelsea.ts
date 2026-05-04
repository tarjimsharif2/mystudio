import axios from 'axios';

async function run() {
  try {
    const res = await axios.get('http://localhost:3000/api/match-stream?url=https://www.okkoora.com/matches/chelsea-vs-manchester-city/');
    console.log(JSON.stringify(res.data, null, 2));
  } catch (e: any) {
    console.error("Failed:", e.message);
  }
}
run();
