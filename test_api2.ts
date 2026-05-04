import axios from 'axios';
async function run() {
  try {
    const res = await axios.get('http://localhost:3000/api/matches');
    console.log(res.data.matches.slice(0, 5));
  } catch (e: any) {
    console.error(e.message);
  }
}
run();
