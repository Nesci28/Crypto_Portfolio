const axios = require("axios");
const fs = require("fs");
const puppeteer = require("puppeteer");
const CoinGecko = require("coingecko-api");
const sgMail = require("@sendgrid/mail");
const monk = require("monk");
require("dotenv").config();

const db = monk(
  `${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_URL}`
);
const collection = db.get(`${process.env.DB_COLLECTION}`);
const miningCollection = db.get(`${process.env.DB_COLLECTION2}`);

// Configs
let config = JSON.parse(fs.readFileSync("./data/config.json").toString());
config = config.config;
let wallets = JSON.parse(fs.readFileSync(process.argv[2]).toString());
walletsWithOptions = wallets;
wallets = wallets.wallets;

// Middlewares
const CoinGeckoClient = new CoinGecko();
sgMail.setApiKey(walletsWithOptions.sendgrid_apiKey);

// Get Coin ID
// async function getID() {
//   let data = await CoinGeckoClient.coins.list();
//   data.data.forEach(el => {
//     if (el.symbol == "sin") {
//       console.log(el);
//     }
//   });
// }
// getID();

// Global initialisation
const balance = {};
const emailSent = {};
const money = {};
let showTheMoney = false;
let counter = 1;
let lastCalculation;

// Error handling
process.on("uncaughtException", function(err) {
  console.log(err);
});

// Main
async function main(step) {
  if (step == "start") {
    let size = await collection.aggregate({
      $project: { count: { $size: "$balance" } }
    });
    if (size.length == 0) {
      lastCalculation = Date.now();
    }
  }

  if (step == "db" || (step == "start" && lastCalculation == undefined)) {
    const lastElement = await collection.aggregate([
      {
        $project: {
          last: { $arrayElemAt: ["$balance", -1] }
        }
      }
    ]);
    if (
      Date.now() - lastElement[0].last.Last_calculation <
      1000 * 60 * 60 * 24
    ) {
      lastCalculation = lastElement[0].last.Last_calculation;
    } else {
      showTheMoney = true;
      lastCalculation = Date.now();
    }
  }
  generateBalance(wallets, lastCalculation);
  await getBitcoinValue();
  await getBalance(wallets);
  calc();
  console.log(balance);
  if (
    walletsWithOptions.email.length > 0 &&
    walletsWithOptions.sendgrid_apiKey.length > 0
  ) {
    await checkForEmail();
  }

  if (step == "db" || step == "start") {
    await insertInDB();
    if (showTheMoney == true) {
      await showMeTheMoney();
      showTheMoney = false;
    }
  }

  setTimeout(async () => {
    if (counter == 60) {
      counter = 1;
      await main("db");
    } else {
      counter = counter + 1;
      await main("");
    }
  }, 1000 * 60);
}

setEmailObject();
main("start");

// Functions
async function showMeTheMoney() {
  let size = await collection.aggregate({
    $project: { count: { $size: "$balance" } }
  });
  if (size[0].count > 0) {
    for (let i = 1; i < size[0].count; i++) {
      var lastElements = await collection.aggregate([
        {
          $project: {
            last: { $arrayElemAt: ["$balance", -1] },
            secondToLast: { $arrayElemAt: ["$balance", (i + 1) * -1] }
          }
        }
      ]);
      if (
        Date.now() - lastElements[0].secondToLast.Time >= 1000 * 60 * 60 * 24 &&
        Date.now() - lastElements[0].secondToLast.Time < 1000 * 60 * 60 * 25
      ) {
        break;
      } else {
        lastElements = "";
      }
    }
    if (lastElements !== "") {
      const keys = getTickers();
      const offset = walletsWithOptions["timezone_offset_in_minutes"];
      let newTime = new Date();
      newTime = new Date(newTime.getTime() + offset * 60 * 1000);
      money["Time"] = newTime;
      keys.forEach(key => {
        let currentBalance = lastElements[0].last[key].total_balance;
        let lastBalance = lastElements[0].secondToLast[key].total_balance;
        const SatsValue = lastElements[0].last[key].value_in_btc;
        if (currentBalance - lastBalance > 0) {
          money[key] = { [key]: 0, BTC: 0, USD: 0 };
          money[key][key] = currentBalance - lastBalance;
          money[key].BTC = (currentBalance - lastBalance) * SatsValue;
          const BTCValue = lastElements[0].last.Bitcoin;
          money[key].USD = money[key].BTC * BTCValue;
        }
      });
      console.log(money);
      miningCollection.update(
        { _id: 1 },
        { $push: { mining_history: money } },
        { upsert: true }
      );
      const msg = [];
      msg.push({
        to: walletsWithOptions.email,
        from: "getBalance@nos.com",
        subject: "Mining Report | Daily",
        text: money
      });
      await sendEmails(msg);
    }
  }
}

async function insertInDB() {
  let size = await collection.aggregate({
    $project: { count: { $size: "$balance" } }
  });
  if (size > 0) {
    let lastElement = await collection.aggregate([
      {
        $project: {
          lastElement: { $arrayElemAt: ["$balance", -1] }
        }
      }
    ]);
    const keys = getTickers();
    keys.forEach(ticker => {
      const tickerLastElement = lastElement[0].lastElement[ticker];
      const tickerCurrent = balance[ticker];
      if (tickerLastElement.total_balance == tickerCurrent.total_balance) {
        delete balance[ticker];
      }
    });
  }
  await collection.update(
    { _id: 1 },
    { $push: { balance: balance } },
    { upsert: true }
  );
}

async function checkForEmail() {
  const keys = getTickers();
  const msg = [];
  keys.forEach(key => {
    const currentValue = balance[key]["value_in_btc"];
    const wantedNotificationHigh = balance[key]["notification_value"]["high"];
    const wantedNotificationLow = balance[key]["notification_value"]["low"];
    if (
      wantedNotificationHigh > 0 &&
      currentValue >= wantedNotificationHigh &&
      emailSent[key]["high"] == 0
    ) {
      msg.push({
        to: walletsWithOptions.email,
        from: "getBalance@nos.com",
        subject: `MOON - ${key} as reached ${currentValue}!`,
        text: `
        ${key} as reached ${currentValue}!
        Your configuration was set to send an email when ${key} value would be equal or higher than ${wantedNotificationHigh}
        `
      });
      emailSent[key]["high"] = 1;
    } else if (
      currentValue < wantedNotificationHigh &&
      emailSent[key]["high"] == 1
    ) {
      emailSent[key]["high"] = 0;
    } else if (
      wantedNotificationLow > 0 &&
      currentValue <= wantedNotificationLow &&
      emailSent[key]["low"] == 0
    ) {
      msg.push({
        to: walletsWithOptions.email,
        from: "getBalance@nos.com",
        subject: `DOWN - ${key} as reached ${currentValue}!`,
        text: `
        ${key} as reached ${currentValue}!
        Your configuration was set to send an email when ${key} value would be equal or higher than ${wantedNotificationLow}
        `
      });
      emailSent[key]["low"] = 1;
    } else if (
      currentValue > wantedNotificationLow &&
      emailSent[key]["low"] == 1
    ) {
      emailSent[key]["low"] = 0;
    }
  });
  await sendEmails(msg);
}

async function sendEmails(msg) {
  for (let i = 0; i < msg.length; i++) {
    message = msg[i];
    await sgMail.send(message);
    console.log("email sent!");
  }
}

async function getBitcoinValue() {
  let value;
  try {
    value = await axios.get(config.BTC.value.api);
    value = value.data;
    let path = config.BTC.value.path;
    value = getPath(path, value);
    value = value.replace(",", "");
    balance["Bitcoin"] = parseFloat(value);
  } catch {
    value = 0;
  }
}

function calc() {
  const keys = getTickers();
  keys.forEach(key => {
    section = balance[key];
    let total =
      section["wallet"]["balance"] +
      section["nanopool"]["balance"] +
      section["suprnova"]["balance"] +
      section["explorer"]["balance"];
    section["total_balance"] = total;
    section["total_value_in_btc"] = total * section["value_in_btc"];
    balance["Portfolio_value_in_btc"] =
      balance["Portfolio_value_in_btc"] + section["total_value_in_btc"];
    section["total_value_in_usd"] =
      section["total_value_in_btc"] * balance["Bitcoin"];
    balance["Portfolio_value_in_usd"] =
      balance["Portfolio_value_in_usd"] + section["total_value_in_usd"];
  });

  const values = Object.entries(balance);
  values.forEach(el => {
    if (typeof el[1] == "number") {
      if (el[0] == "Bitcoin" || el[0] == "Portfolio_value_in_usd") {
        balance[el[0]] = parseFloat(el[1].toFixed(2));
      } else {
        balance[el[0]] = parseFloat(el[1].toFixed(8));
      }
    } else if (typeof el[1] == "object") {
      const ticker = el[0];
      const nestedValues = Object.entries(el[1]);
      nestedValues.forEach(nestedValue => {
        if (typeof nestedValue[1] == "number") {
          balance[ticker][nestedValue[0]] = parseFloat(
            nestedValue[1].toFixed(8)
          );
        } else if (typeof nestedValue[1] == "object") {
          const nestedTicker = nestedValue[0];
          const dNestedValues = Object.entries(nestedValue[1]);
          dNestedValues.forEach(dNestedValue => {
            if (typeof dNestedValue[1] == "number") {
              balance[ticker][nestedTicker][dNestedValue[0]] = parseFloat(
                dNestedValue[1].toFixed(8)
              );
            }
          });
        }
      });
    }
  });
}

async function getBalance(wallets) {
  for (let i = 0; i < wallets.length; i++) {
    const wallet = wallets[i];
    const ticker = wallet.ticker;
    const address = wallet.address;
    const nanopool = wallet.nanopool;
    const suprnova = wallet.suprnova.apiKey;
    const checkOnExplorer = wallet.checkOnExplorer;
    const manualBalance = wallet.manualBalance;

    const api = config[ticker].api;
    const apiKey = config[ticker].key;
    const path = config[ticker].path;

    const scrap = config[ticker].scrap;
    const scrapFields = config[ticker].scrap_fields;

    let id = config[ticker].id;

    await getCoinValue(ticker, id);

    if (api !== undefined && checkOnExplorer) {
      if (api.length > 0) {
        await getFromExplorer(ticker, api, apiKey, address, path);
      }
    }
    if (scrap !== undefined && checkOnExplorer) {
      if (scrap.length > 0) {
        await getFromScrapping(address, ticker, scrap, scrapFields);
      }
    }
    if (nanopool) {
      await getFromNanopool(ticker, address);
    }
    if (suprnova !== undefined) {
      if (suprnova.length > 0) {
        await getFromSuprnova(ticker, suprnova);
      }
    }
    if (manualBalance !== undefined) {
      balance[ticker]["wallet"]["balance"] = parseFloat(
        manualBalance.toFixed(8)
      );
    }
  }
}

async function getFromScrapping(address, ticker, site, fields) {
  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1; SV1; .NET CLR 1.1.4322)"
    );
    await page.goto(site + address, { waitUntil: "load", timeout: 0 });
    const total = await page.evaluate(fields => {
      return document.querySelector(fields).innerHTML;
    }, fields);
    balance[ticker]["explorer"]["balance"] = parseFloat(total);
    await browser.close();
  } catch {
    balance[ticker]["explorer"]["balance"] = parseFloat(0);
  }
}

async function getCoinValue(ticker, id) {
  try {
    let data = await CoinGeckoClient.coins.fetch(id, {});
    data = data.data;
    balance[ticker]["value_in_btc"] = data.market_data.current_price.btc;
  } catch {
    balance[ticker]["value_in_btc"] = 0;
  }
}

async function getFromSuprnova(ticker, apiKey, walletBalance = "") {
  try {
    if (config[ticker].suprnova) {
      const api = config[ticker].suprnova.api;
      let path = config[ticker].suprnova.path;

      if (api && path) {
        let walletBalance;
        try {
          walletBalance = await axios.get(api, {
            params: {
              api_key: apiKey
            }
          });
        } catch {}
        walletBalance = walletBalance.data;
        path = path.split(".");
        path.forEach(el => {
          walletBalance = walletBalance[el];
        });
        walletBalance =
          parseFloat(walletBalance.confirmed) +
          parseFloat(walletBalance.unconfirmed);
        balance[ticker]["suprnova"]["balance"] = walletBalance;
      }
    }
  } catch {}
}

async function getFromNanopool(ticker, address, walletBalance = "") {
  try {
    if (config[ticker].nanopool) {
      const api = config[ticker].nanopool.api;
      const path = config[ticker].nanopool.path;

      if (api && path) {
        try {
          walletBalance = await axios.get(api + address);
        } catch {}
        walletBalance = walletBalance.data;
        walletBalance = walletBalance[path];
        walletBalance = parseFloat(walletBalance);
        balance[ticker]["nanopool"]["balance"] = walletBalance;
      }
    }
  } catch {}
}

async function getFromExplorer(
  ticker,
  api,
  apiKey,
  address,
  path,
  walletBalance = ""
) {
  if (api.length > 0 && apiKey.length == 0) {
    try {
      walletBalance = await axios.get(api + address);
    } catch {}
  } else if (api.length > 0 && apiKey.length > 0) {
    try {
      walletBalance = await axios.get(api + address, {
        params: {
          apiKey: apiKey[1]
        }
      });
    } catch {}
  }
  if (walletBalance) {
    walletBalance = walletBalance.data;
    if (path.match(".")) {
      walletBalance = getPath(path, walletBalance);
    } else {
      walletBalance = walletBalance[path];
    }
    walletBalance = parseFloat(walletBalance);
    balance[ticker]["explorer"]["balance"] = walletBalance;
  }
}

// Utilities
// Converting milliseconds to hours/minutes/seconds
function parseMillisecondsIntoReadableTime(milliseconds) {
  //Get hours from milliseconds
  var hours = milliseconds / (1000 * 60 * 60);
  var absoluteHours = Math.floor(hours);
  var h = absoluteHours > 9 ? absoluteHours : "0" + absoluteHours;

  //Get remainder from hours and convert to minutes
  var minutes = (hours - absoluteHours) * 60;
  var absoluteMinutes = Math.floor(minutes);
  var m = absoluteMinutes > 9 ? absoluteMinutes : "0" + absoluteMinutes;

  //Get remainder from minutes and convert to seconds
  var seconds = (minutes - absoluteMinutes) * 60;
  var absoluteSeconds = Math.floor(seconds);
  var s = absoluteSeconds > 9 ? absoluteSeconds : "0" + absoluteSeconds;

  return h + ":" + m + ":" + s;
}

// Setting up the balance object
function generateBalance(wallets, last_calculation) {
  wallets.forEach(wallet => {
    balance["Time"] = Date.now();
    balance["Last_calculation"] = last_calculation;
    balance["Next_mining_update"] = parseMillisecondsIntoReadableTime(
      1000 * 60 * 60 * 24 - (balance["Time"] - last_calculation)
    );
    balance["Bitcoin"] = 0;
    balance["Portfolio_value_in_usd"] = 0;
    balance["Portfolio_value_in_btc"] = 0;
    balance[wallet.ticker] = {};
    balance[wallet.ticker]["total_balance"] = 0;
    balance[wallet.ticker]["total_value_in_usd"] = 0;
    balance[wallet.ticker]["total_value_in_btc"] = 0;
    balance[wallet.ticker]["value_in_btc"] = 0;
    balance[wallet.ticker]["notification_value"] = {};
    balance[wallet.ticker]["notification_value"]["high"] =
      parseFloat(wallet["notification_value"]["high"]) || 0;
    balance[wallet.ticker]["notification_value"]["low"] =
      parseFloat(wallet["notification_value"]["low"]) || 0;
    balance[wallet.ticker]["wallet"] = {};
    balance[wallet.ticker]["wallet"]["balance"] = 0;
    balance[wallet.ticker]["explorer"] = {};
    balance[wallet.ticker]["explorer"]["balance"] = 0;
    balance[wallet.ticker]["nanopool"] = {};
    balance[wallet.ticker]["nanopool"]["balance"] = 0;
    balance[wallet.ticker]["suprnova"] = {};
    balance[wallet.ticker]["suprnova"]["balance"] = 0;
  });
}

// Setting up the emailSent object
function setEmailObject() {
  const keys = getTickers();
  keys.forEach(key => {
    emailSent[key] = { high: 0, low: 0 };
  });
}

// Get all the configured tickers
function getTickers() {
  const keys = [];
  wallets.forEach(el => {
    keys.push(el.ticker);
  });
  return keys;
}

// Get value from a multiple nested path
function getPath(path, value) {
  path = path.split(".");
  path.forEach(el => {
    value = value[el];
  });
  return value;
}
