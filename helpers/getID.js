const CoinGecko = require("coingecko-api");
const CoinGeckoClient = new CoinGecko();

module.exports = async function(ticker) {
  ticker = ticker.toLowerCase();
  let data = await CoinGeckoClient.coins.list();
  for (let i = 0; i < data.data.length; i++) {
    const el = data.data[i];
    if (el.symbol == ticker) {
      return el;
    }
  }
  return null;
};
