exports.tickerBTC = async function calc(balance) {
  return parseFloat(
    (balance["total_balance"] * balance["value_in_btc"]).toFixed(8)
  );
};

exports.tickerUSD = async function calc(balance, btcPrice) {
  return parseFloat((balance["total_in_btc"] * btcPrice).toFixed(2));
};

exports.total = async function calc(balance, tickers) {
  let totalBTC = 0;
  let totalUSD = 0;
  tickers.forEach(ticker => {
    totalBTC += balance[ticker.toUpperCase()]["total_in_btc"];
    totalUSD += balance[ticker.toUpperCase()]["total_in_usd"];
  });
  return {
    totalBTC,
    totalUSD
  };
};

exports.difference = async function calc(report, balance, tickers) {
  const calculatedReport = {};
  for (let i = 0; i < tickers.length; i++) {
    const ticker = report[i]["ticker"];
    const pastValue = report[i]["mean_total_balance"];
    const currentValue = balance[ticker]["total_balance"];
    calculatedReport[ticker] = {};
    calculatedReport[ticker]["coin_earning"] = parseFloat(
      (currentValue - pastValue).toFixed(8)
    );
    calculatedReport[ticker]["total_in_btc"] = parseFloat(
      (
        calculatedReport[ticker]["coin_earning"] *
        balance[ticker]["value_in_btc"]
      ).toFixed(8)
    );
    calculatedReport[ticker]["total_in_usd"] = parseFloat(
      (calculatedReport[ticker]["total_in_btc"] * balance["Bitcoin"]).toFixed(8)
    );
    if (calculatedReport[ticker]["coin_earning"] == 0)
      delete calculatedReport[ticker];
  }
  calculatedReport["Total"] = {};
  calculatedReport["Total"]["total_in_btc"] = calcTotal(
    calculatedReport,
    tickers,
    "total_in_btc"
  );
  calculatedReport["Total"]["total_in_usd"] = calcTotal(
    calculatedReport,
    tickers,
    "total_in_usd"
  );

  return calculatedReport;
};

function calcTotal(calculatedReport, tickers, type) {
  let total = 0;
  for (let i = 0; i < tickers.length; i++) {
    try {
      total += calculatedReport[tickers[i]][type];
    } catch {}
  }
  return total;
}
