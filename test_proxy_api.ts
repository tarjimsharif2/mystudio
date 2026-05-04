import axios from 'axios';

async function run() {
  try {
    const res = await axios.get('http://localhost:3000/api/proxy?url=https://nbuiaaaaaaaa.kora-live-live.info/hls/ch3/master.m3u8');
    console.log(res.data.substring(0, 300));
  } catch (e: any) {
    console.error("Failed:", e.message);
  }
}
run();
