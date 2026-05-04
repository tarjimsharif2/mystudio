import axios from 'axios';

async function run() {
  try {
    const res = await axios.get('http://localhost:3000/api/match-stream?url=https://frfff.shootwithyalla.com/albaplayer/sports-3/?serv=1');
    console.log(JSON.stringify(res.data, null, 2));
  } catch (e: any) {
    console.error("Failed:", e.message);
  }
}
run();
