import axios from 'axios';

async function run() {
  const url = 'https://frfff.shootwithyalla.com/albaplayer/sports-3/';
  try {
    const res = await axios.get(url);
    console.log("Success without headers!");
  } catch (e: any) {
    console.error("Failed without headers:", e.message);
  }
}
run();
