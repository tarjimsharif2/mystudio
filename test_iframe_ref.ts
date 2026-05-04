import axios from 'axios';

async function run() {
  try {
    const res = await axios.get('https://testjojoo.s3.eu-north-1.amazonaws.com/bein1.html');
    console.log("Status:", res.status);
    console.log("Headers:", res.headers);
  } catch (e: any) {
    console.error("Failed:", e.message);
  }
}
run();
