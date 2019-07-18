const axios = require("axios");
const puppeteer = require("puppeteer");

module.exports = async function(ticker, wallets, config) {
  let wallet;
  global.balance = {};
  for (let i = 0; i < wallets.length; i++) {
    if (wallets[i].ticker == ticker) {
      wallet = wallets[i];
    }
  }

  // Check for Manual Balance
  if (wallet["manualBalance"] > 0) {
    balance["manual_balance"] = parseFloat(wallet["manualBalance"].toFixed(8));
  }

  // check for Explorer
  try {
    if (config[ticker.toUpperCase()]["api"] && wallet["explorer"]) {
      await getFromGeneral(
        ticker,
        config[ticker.toUpperCase()]["api"],
        wallet["address"],
        config[ticker.toUpperCase()]["path"],
        "explorer",
        axios,
        config[ticker.toUpperCase()]["key"]
      );
    }
  } catch {}

  // Check for Scrapping
  try {
    if (config[ticker.toUpperCase()]["scrap"] && wallet["explorer"]) {
      await getFromScrapping(
        ticker,
        config[ticker.toUpperCase()]["scrap"],
        wallet["address"],
        config[ticker.toUpperCase()]["scrap_fields"],
        puppeteer
      );
    }
  } catch {}

  // check for Nanopool
  try {
    if (config[ticker.toUpperCase()]["nanopool"]["api"] && wallet["nanopool"]) {
      await getFromGeneral(
        ticker,
        config[ticker.toUpperCase()]["nanopool"]["api"],
        wallet["address"],
        config[ticker.toUpperCase()]["nanopool"]["path"],
        "nanopool",
        axios
      );
    }
  } catch {}

  // Check for Ethermine
  try {
    if (
      config[ticker.toUpperCase()]["ethermine"]["api"] &&
      wallet["ethermine"]
    ) {
      await getFromGeneral(
        ticker,
        config[ticker.toUpperCase()]["ethermine"]["api"],
        wallet["address"],
        config[ticker.toUpperCase()]["ethermine"]["path"],
        "ethermine",
        axios
      );
    }
  } catch {}

  // Check for 2miners
  try {
    if (config[ticker.toUpperCase()]["2miners"]["api"] && wallet["2miners"]) {
      await getFromGeneral(
        ticker,
        config[ticker.toUpperCase()]["2miners"]["api"],
        wallet["address"],
        config[ticker.toUpperCase()]["2miners"]["path"],
        "two_miners",
        axios
      );
    }
  } catch {}

  // Check for suprnova
  try {
    if (
      config[ticker.toUpperCase()]["suprnova"]["api"] &&
      wallet["suprnova"]["apiKey"]
    ) {
      await getFromGeneral(
        ticker,
        config[ticker.toUpperCase()]["suprnova"]["api"],
        wallet["address"],
        config[ticker.toUpperCase()]["suprnova"]["path"],
        "suprnova",
        axios,
        wallet["suprnova"]["apiKey"]
      );
    }
  } catch {}

  balance["total_balance"] = getTotal();
  return balance;
};

// Functions
async function getFromScrapping(api, address, fields, puppeteer) {
  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1; SV1; .NET CLR 1.1.4322)"
    );
    await page.goto(api + address, { waitUntil: "load", timeout: 0 });
    const total = await page.evaluate(fields => {
      return document.querySelector(fields).innerHTML;
    }, fields);
    balance["explorer"] = parseFloat(total);
    await browser.close();
  } catch {
    balance["explorer"] = parseFloat(0);
  }
}

async function getFromGeneral(
  ticker,
  api,
  address,
  path,
  type,
  axios,
  apiKey = ""
) {
  let walletBalance = 0;
  if (path.includes("<address>")) path = path.replace("<address>", address);
  if (api.includes("<address>")) api = api.replace("<address>", address);

  try {
    if (type == "explorer" || type == "nanopool" || type == "two_miners") {
      if (apiKey) {
        walletBalance = await axios.get(api + address, {
          params: {
            apiKey: apiKey[1]
          }
        });
      } else {
        walletBalance = await axios.get(api + address);
      }
    } else if (type == "ethermine") {
      walletBalance = await axios.get(api);
    } else if (type == "suprnova") {
      walletBalance = await axios.get(api, {
        params: {
          api_key: apiKey
        }
      });
    }
  } catch {}
  if (walletBalance) {
    let total = 0;
    walletBalance = walletBalance.data;
    if (type == "two_miners") {
      const path1 = path[0];
      const path2 = path[1];
      total = getPath(path1, walletBalance);
      total = total + getPath(path2, walletBalance);
    } else {
      walletBalance = getPath(path, walletBalance);
    }
    if (type == "ethermine" && ticker.toUpperCase() == "ETH")
      walletBalance = (walletBalance / 1000000000000000000).toFixed(8);
    if (type == "two_miners" && ticker.toUpperCase() == "XZC") {
      walletBalance = total / 100000000;
    }
    if (type == "suprnova")
      walletBalance =
        parseFloat(walletBalance.confirmed) +
        parseFloat(walletBalance.unconfirmed);
    walletBalance = parseFloat(walletBalance);
  }
  balance[type] = parseFloat(walletBalance.toFixed(8));
}

// Get Total Balance from all the keys in balance
function getTotal() {
  const keys = Object.keys(balance);
  let total = 0;
  keys.forEach(key => {
    total += balance[key];
  });
  return parseFloat(total.toFixed(8));
}

// Get value from a multiple nested path
function getPath(path, value) {
  path = path.split(".");
  path.forEach(el => {
    value = value[el];
  });
  return value;
}
