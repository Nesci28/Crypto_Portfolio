// Global Config
const interval = 1000 * 60;
const reportTime = 2100;
const balance = {};
let emailSent = {};
let reportSent = {
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  day:
    process.argv[3] == "dev" ? new Date().getDate() - 1 : new Date().getDate()
};
let dbExist = false;

// Dependancies
const fs = require("fs");
const prettyjson = require("prettyjson");

// Scripts dependancies
const influx = require("./app/influxDB.js");
const mongo = require("./app/mongoDB.js");
const getTickers = require("./app/getTickers.js");
const getValue = require("./app/getValue.js");
const getBalance = require("./app/getBalance.js");
const calc = require("./app/calculator.js");
const notif = require("./app/notification.js");

// Helpers dependancies
const getID = require("./helpers/getID.js");
const calcTickerBTC = calc.tickerBTC;
const calcTickerUSD = calc.tickerUSD;
const calcTotal = calc.total;
const influxPortfolio = influx.influxPortfolio;
const influxTicker = influx.influxTicker;
const influxReport = influx.influxReport;
const influxCreation = influx.influxCreation;
const mongoBalance = mongo.mongoBalance;
const mongoReport = mongo.mongoReport;
const notification = notif.notification;
const report = notif.report;

// Check if getID
if (!process.argv[2].includes("json")) {
  return (async () => {
    console.log(await getID(process.argv[2]));
    process.exit();
  })();
}

// Configs
let config = JSON.parse(fs.readFileSync("./data/config.json").toString());
let wallets = JSON.parse(fs.readFileSync(process.argv[2]).toString());
config = config.config;
walletsWithOptions = wallets;
wallets = wallets.wallets;

// Error handling
process.on("uncaughtException", function(err) {
  console.log(err);
});

// Get List of Tickers
const tickers = getTickers(wallets);

// Main
async function main(tickers) {
  balance["Time"] = Date.now();
  // Get Bitcoin value
  balance["Bitcoin"] = await getValue("bitcoin");
  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i];
    const id = config[ticker.toUpperCase()]["id"];

    // Initializing the nested object for the Coin
    balance[ticker.toUpperCase()] = {};

    // Get BTC Value of the Coin
    if (ticker.toUpperCase() == "BTC") {
      balance[ticker.toUpperCase()]["value_in_btc"] = 1;
    } else {
      balance[ticker.toUpperCase()]["value_in_btc"] = await getValue(id);
    }

    // Get the balance
    const getbalance = await getBalance(ticker, wallets, config);
    balance[ticker.toUpperCase()] = {
      ...balance[ticker.toUpperCase()],
      ...getbalance
    };

    // Calculating the sub total in usd and btc
    balance[ticker.toUpperCase()]["total_in_btc"] = await calcTickerBTC(
      balance[ticker.toUpperCase()]
    );
    balance[ticker.toUpperCase()]["total_in_usd"] = await calcTickerUSD(
      balance[ticker.toUpperCase()],
      balance["Bitcoin"]
    );
  }

  // Calculating the total portfolio
  let totals = await calcTotal(balance, tickers);
  balance["portfolio_in_btc"] = parseFloat(totals.totalBTC.toFixed(8));
  balance["portfolio_in_usd"] = parseFloat(totals.totalUSD.toFixed(2));

  // Create the influxDB
  if (!dbExist) {
    await influxCreation();
  }

  // Push to InfluxDB
  influxPortfolio(balance);
  influxTicker(tickers, balance);

  // Push to MongoDB
  mongoBalance(balance);

  // Check for Notifications
  if (process.argv[3] !== "dev") {
    emailSent = await notification(
      tickers,
      balance,
      wallets,
      emailSent,
      walletsWithOptions
    );
  }

  // Check for Mining Report
  if (process.argv[3] !== "dev") {
    const calculatedReport = await report(
      reportSent,
      reportTime,
      balance,
      walletsWithOptions.email,
      tickers
    );
    if (calculatedReport.sendAReport) {
      reportSent = calculatedReport.reportSent;
      const dailyReport = calculatedReport.difference;
      // Push report to MongoDB
      mongoReport(dailyReport);
      // Push report to InfluxDB
      influxReport(dailyReport, tickers);
    }
  }

  // Show the UI
  process.stdout.write("\u001b[2J\u001b[0;0H");
  console.log(prettyjson.render(balance));

  // Show timer
  let counter = 60;
  let countdown = setInterval(() => {
    if (counter == 60) process.stdout.write(counter + "s");
    if (counter < 60 && counter > 0) {
      process.stdout.clearLine();
      process.stdout.cursorTo(0);
      process.stdout.write(counter + "s");
    }
    if (counter == 0) {
      process.stdout.clearLine();
      process.stdout.cursorTo(0);
      process.stdout.write(counter + "s... Updating...");
      clearInterval(countdown);
    }
    counter--;
  }, 1000);

  setTimeout(async () => {
    await main(tickers);
  }, interval);
}

// Call the functions
(async () => {
  await main(tickers);
})();
