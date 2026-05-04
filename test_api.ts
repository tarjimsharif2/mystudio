import axios from 'axios';
async function run() {
  try {
    const res = await axios.get('http://localhost:3000/api/match-stream?url=https://www.okkoora.com/matches/sheffield-united-vs-bristol-city/');
    console.log(res.data);
  } catch (e: any) {
    console.error(e.message);
  }
}
run();
