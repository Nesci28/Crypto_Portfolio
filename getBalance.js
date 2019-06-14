const axios = require("axios");
const fs = require("fs");
const CoinGecko = require("coingecko-api");
const sgMail = require("@sendgrid/mail");
const puppeteer = require("puppeteer");

// Configs
let config = JSON.parse(fs.readFileSync("./data/config.json").toString());
config = config.config;
let wallets = JSON.parse(fs.readFileSync("config.json").toString());
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

// Main
async function main() {
  generateBalance(wallets);
  await getBitcoinValue();
  await getBalance(wallets);
  calc();
  await checkForEmail();
  console.log(balance);
  console.log(emailSent);
  setTimeout(async () => {
    await main();
  }, 60 * 1000);
}

setEmailObject();
main();

// Functions
function setEmailObject() {
  const keys = getTickers();
  keys.forEach(key => {
    emailSent[key] = { high: 0, low: 0 };
  });
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
  let value = await axios.get(config.BTC.value.api);
  value = value.data;
  let path = config.BTC.value.path;
  value = getPath(path, value);
  value = value.replace(",", "");
  balance["Bitcoin"] = parseFloat(value);
}

function calc() {
  const keys = getTickers();
  keys.forEach(key => {
    section = balance[key];
    let total =
      section["wallet"]["balance"] +
      section["nanopool"]["balance"] +
      section["suprnova"]["balance"];
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

function generateBalance(wallets) {
  wallets.forEach(wallet => {
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
    balance[wallet.ticker]["nanopool"] = {};
    balance[wallet.ticker]["nanopool"]["balance"] = 0;
    balance[wallet.ticker]["suprnova"] = {};
    balance[wallet.ticker]["suprnova"]["balance"] = 0;
  });
}

async function getBalance(wallets) {
  for (let i = 0; i < wallets.length; i++) {
    const wallet = wallets[i];
    const ticker = wallet.ticker;
    const address = wallet.address;
    const nanopool = wallet.nanopool;
    const suprnova = wallet.suprnova.apiKey;

    const api = config[ticker].api;
    const apiKey = config[ticker].key;
    const path = config[ticker].path;

    const scrap = config[ticker].scrap;
    const scrapFields = config[ticker].scrap_fields;

    let id = config[ticker].id;

    await getCoinValue(ticker, id);

    if (api !== undefined) {
      if (api.length > 0) {
        await getFromExplorer(ticker, api, apiKey, address, path);
      }
    }
    if (scrap !== undefined) {
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
  }
}

async function getFromScrapping(address, ticker, site, fields) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(site + address);
  const total = await page.evaluate(fields => {
    return document.querySelector(fields).innerHTML;
  }, fields);
  balance[ticker]["wallet"]["balance"] = parseFloat(total);
}

async function getCoinValue(ticker, id) {
  let data = await CoinGeckoClient.coins.fetch(id, {});
  data = data.data;
  balance[ticker]["value_in_btc"] = data.market_data.current_price.btc;
}

async function getFromSuprnova(ticker, apiKey, walletBalance = "") {
  try {
    if (config[ticker].suprnova) {
      const api = config[ticker].suprnova.api;
      let path = config[ticker].suprnova.path;

      if (api && path) {
        walletBalance = await axios.get(api, {
          params: {
            api_key: apiKey
          }
        });
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
        walletBalance = await axios.get(api + address);
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
    walletBalance = await axios.get(api + address);
  } else if (api.length > 0 && apiKey.length > 0) {
    walletBalance = await axios.get(api + address, {
      params: {
        apiKey: apiKey[1]
      }
    });
  }
  if (walletBalance) {
    walletBalance = walletBalance.data;
    if (path.match(".")) {
      walletBalance = getPath(path, walletBalance);
    } else {
      walletBalance = walletBalance[path];
    }
    walletBalance = parseFloat(walletBalance);
    balance[ticker]["wallet"]["balance"] = walletBalance;
  }
}

// Utilities
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
