import axios from 'axios';
async function run() {
  try {
    const res = await axios.get('https://frfff.shootwithyalla.com/wp-content/plugins/AlbaPlayer/assets/js/albaplayerrrr.js?v=11.1');
    console.log(res.data.substring(2000, 4000));
  } catch (e: any) {
    console.error(e.message);
  }
}
run();
