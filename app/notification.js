const sgMail = require("@sendgrid/mail");
require("dotenv").config();
sgMail.setApiKey(process.env.SENDGRIB_APIKEY);

const influx = require("../app/influxDB.js");
const influxReport = influx.report;
const calc = require("../app/calculator.js");
const calcDifference = calc.difference;

const getID = require("../helpers/getID.js");

exports.report = async function(
  reportSent,
  reportTime,
  balance,
  email,
  tickers
) {
  let difference;
  let sendAReport = false;
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const hour = now
    .getHours()
    .toString()
    .padStart(2, "0");
  const min = now
    .getMinutes()
    .toString()
    .padStart(2, "0");

  if (
    (year > reportSent.year ||
      month > reportSent.month ||
      day > reportSent.day) &&
    Number(hour + min) > reportTime
  ) {
    sendAReport = true;
    reportSent = {
      year,
      month,
      day
    };
    // Pull the 24h report from influxDB
    const report = await influxReport();
    // Calculate the difference with the current Balance
    difference = calcDifference(report, balance, tickers);
    // Send report
    sendReport(difference, email, tickers);
  }

  return {
    sendAReport: sendAReport,
    reportSent: reportSent,
    difference: difference
  };
};

exports.notification = async function(
  tickers,
  balance,
  wallets,
  emailSent,
  walletsWithOptions
) {
  tickers.forEach(ticker => {
    for (let i = 0; i < wallets.length; i++) {
      if (wallets[i].ticker == ticker) {
        wallet = wallets[i];
      }
    }
    if (wallet["notification_value"]["high"]) {
      const high = wallet["notification_value"]["high"];
      const difference = high / 10;
      const email = checkEmail(
        ticker,
        balance[ticker.toUpperCase()]["value_in_btc"],
        high,
        emailSent,
        difference,
        "high"
      );
      if (balance[ticker.toUpperCase()]["value_in_btc"] >= high && email.send) {
        emailSent[ticker] = email.pourcent;
        sendMessage(
          walletsWithOptions,
          ticker,
          balance[ticker.toUpperCase()]["value_in_btc"],
          email.message
        );
      }
    }

    if (wallet["notification_value"]["low"]) {
      const low = wallet["notification_value"]["low"];
      const difference = low / 10;
      const email = checkEmail(
        ticker,
        balance[ticker.toUpperCase()]["value_in_btc"],
        low,
        emailSent,
        difference,
        "low"
      );
      if (balance[ticker.toUpperCase()]["value_in_btc"] <= low && email.send) {
        emailSent[ticker] = email.pourcent;
        sendMessage(
          walletsWithOptions,
          ticker,
          balance[ticker.toUpperCase()]["value_in_btc"],
          email.message
        );
      }
    }
  });

  return emailSent;
};

async function sendReport(difference, email, tickers) {
  let message = "";
  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i];
    try {
      message += `
You mined ${difference[ticker]["coin_earning"]} of ${ticker}  
Which is worth ${difference[ticker]["total_in_btc"]} in Bitcoin  
And ${difference[ticker]["total_in_usd"]} in USD
      `;
    } catch {}
  }
  message += `
Total of your gain is :  
${parseFloat(difference["Total"]["total_in_btc"].toFixed(8))} in Bitcoin  
${parseFloat(difference["Total"]["total_in_usd"].toFixed(8))} in USD
  `;
  const msg = {
    to: email,
    from: "getBalance@nos.com",
    subject: `Daily Report - mining daily report!`,
    text: message
  };
  await sgMail.send(msg);
}

async function sendMessage(options, ticker, currentValue, message) {
  const coin = await getID(ticker);
  const msg = {
    to: options.email,
    from: "getBalance@nos.com",
    subject: `${message} - ${coin.name} as reached ${currentValue}!`,
    text: `${coin.name} as reached ${currentValue}!`
  };
  await sgMail.send(msg);
}

function checkEmail(ticker, currentValue, amount, emailSent, difference, type) {
  try {
    if (!emailSent[ticker]) {
      return {
        send: true,
        message: type == "high" ? "👍 UP" : "👎 DOWN",
        pourcent:
          type == "high"
            ? Math.floor((currentValue - amount) / difference) * 10
            : Math.floor((amount - currentValue) / difference) * -10
      };
    } else if (type == "high") {
      if (emailSent[ticker] > 0) {
        if (
          emailSent[ticker] <
          Math.floor((currentValue - amount) / difference) * 10
        ) {
          return {
            send: true,
            message: "👍 HIGH Increasing",
            pourcent: Math.floor((currentValue - amount) / difference) * 10
          };
        } else if (
          emailSent[ticker] >
          Math.floor((currentValue - amount) / difference) * 10
        ) {
          return {
            send: true,
            message: "👎 HIGH Decreasing",
            pourcent: Math.floor((currentValue - amount) / difference) * 10
          };
        } else {
          return {
            send: false
          };
        }
      }
    } else if (type == "low") {
      if (emailSent[ticker] < 0) {
        if (
          emailSent[ticker] <
          Math.floor((amount - currentValue) / difference) * -10
        ) {
          return {
            send: true,
            message: "👎 DOWN Decreasing",
            pourcent: Math.floor((amount - currentValue) / difference) * -10
          };
        } else if (
          emailSent[ticker] >
          Math.floor((amount - currentValue) / difference) * -10
        ) {
          return {
            send: true,
            message: "👎 DOWN Increasing",
            pourcent: Math.floor((amount - currentValue) / difference) * -10
          };
        } else {
          return {
            send: false
          };
        }
      }
    } else {
      return {
        send: false
      };
    }
  } catch {
    console.log("catch");
    return {
      send: false
    };
  }
}
