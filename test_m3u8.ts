import axios from 'axios';

async function run() {
  const url = 'https://nbuiaaaaaaaa.kora-live-live.info/hls/ch3/master.m3u8';
  try {
    const res = await axios.get(url);
    console.log("Success without headers!");
    console.log(res.data.substring(0, 200));
  } catch (e: any) {
    console.error("Failed without headers:", e.message);
    if (e.response) console.error("Status:", e.response.status);
    
    try {
      const res2 = await axios.get(url, {
        headers: {
          "Referer": "https://frfff.shootwithyalla.com/",
          "Origin": "https://frfff.shootwithyalla.com"
        }
      });
      console.log("Success WITH headers!");
      console.log(res2.data.substring(0, 200));
    } catch (e2: any) {
      console.error("Failed WITH headers:", e2.message);
    }
  }
}
run();
