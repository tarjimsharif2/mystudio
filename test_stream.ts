import axios from 'axios';
async function run() {
  try {
    const res = await axios.get('https://frfff.shootwithyalla.com/albaplayer/sports-4/');
    console.log(res.data.substring(0, 1000));
  } catch (e: any) {
    console.error(e.message);
  }
}
run();
