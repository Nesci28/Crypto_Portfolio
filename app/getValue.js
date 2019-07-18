const CoinGecko = require("coingecko-api");
const CoinGeckoClient = new CoinGecko();

module.exports = async function(id) {
  let data = await CoinGeckoClient.coins.fetch(id, {});
  data = data.data;
  if (id == "bitcoin") {
    data = data.market_data.current_price.usd;
  } else {
    data = data.market_data.current_price.btc;
  }
  return data;
};
