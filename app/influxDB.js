exports.report = async function() {
  const Influx = require("influx");
  const influx = new Influx.InfluxDB({
    host: "localhost",
    database: "getBalance",
    port: 8086
  });
  const time = process.argv[3] == "dev" ? "1s" : "24h";
  return influx
    .query(
      `SELECT mean("total_balance") AS "mean_total_balance" FROM "getBalance"."autogen"."balances" WHERE time < now() - ${time} GROUP BY * ORDER BY ASC LIMIT 1`
    )
    .catch(err => {
      console.log(err);
    })
    .then(results => {
      return results;
    });
};

exports.influxReport = async function(report, tickers) {
  const Influx = require("influx");
  // Total
  const influxReport = influxConnection("report", Influx);
  // Write to DB
  influxReport.writePoints([
    {
      measurement: "mining_report",
      tags: { total: "total" },
      fields: {
        total_in_usd: report["Total"]["total_in_usd"],
        total_in_btc: report["Total"]["total_in_btc"]
      }
    }
  ]);

  // Tickers
  const influxReportTicker = influxConnection("reportTicker", Influx);
  tickers.forEach(ticker => {
    // Write to DB
    try {
      influxReportTicker.writePoints([
        {
          measurement: "mining_report",
          tags: { ticker: ticker },
          fields: {
            coin_earning: report[ticker]["coin_earning"],
            total_in_usd: report[ticker]["total_in_usd"],
            total_in_btc: report[ticker]["total_in_btc"]
          }
        }
      ]);
    } catch {}
  });
};

exports.influxPortfolio = async function(balance) {
  const Influx = require("influx");
  const influxPortfolio = influxConnection("portfolio", Influx);

  // Create the DB
  await influxPortfolio.getDatabaseNames().then(names => {
    if (!names.includes("getBalance")) {
      return influxPortfolio.createDatabase("getBalance");
    }
  });

  // Write to DB
  influxPortfolio.writePoints([
    {
      measurement: "balances",
      tags: { portfolio: "portfolio" },
      fields: {
        value: balance["Bitcoin"],
        portfolio_in_usd: balance["portfolio_in_usd"],
        portfolio_in_btc: balance["portfolio_in_btc"]
      }
    }
  ]);
};

exports.influxTicker = async function(tickers, balance) {
  const Influx = require("influx");
  const influxTicker = influxConnection("ticker", Influx);
  tickers.forEach(ticker => {
    influxTicker.writePoints([
      {
        measurement: "balances",
        tags: { ticker: ticker },
        fields: {
          total_balance: balance[ticker.toUpperCase()]["total_balance"],
          total_in_usd: balance[ticker.toUpperCase()]["total_in_usd"],
          total_in_btc: balance[ticker.toUpperCase()]["total_in_btc"],
          value_in_btc: balance[ticker.toUpperCase()]["vue_in_btc"],
          wallet: balance[ticker.toUpperCase()]["wallet"] || 0,
          explorer: balance[ticker.toUpperCase()]["explorer"] || 0,
          suprnova: balance[ticker.toUpperCase()]["suprnova"] || 0,
          ethermine: balance[ticker.toUpperCase()]["ethermine"] || 0,
          TwoMiners: balance[ticker.toUpperCase()]["two_miners"] || 0
        }
      }
    ]);
  });
};

exports.influxCreation = async function() {
  const Influx = require("influx");
  const influxPortfolio = influxConnection("portfolio", Influx);

  // Create the DB
  await influxPortfolio.getDatabaseNames().then(names => {
    if (!names.includes("getBalance")) {
      return influxPortfolio.createDatabase("getBalance");
    }
  });

  return true;
};

// InfluxDB Connections/Schemas
function influxConnection(step, Influx) {
  if (step == "portfolio") {
    return new Influx.InfluxDB({
      host: "localhost",
      database: "getBalance",
      schema: [
        {
          measurement: "balances",
          fields: {
            value: Influx.FieldType.FLOAT,
            portfolio_in_usd: Influx.FieldType.FLOAT,
            portfolio_in_btc: Influx.FieldType.FLOAT
          },
          tags: ["portfolio"]
        }
      ]
    });
  } else if (step == "report") {
    return new Influx.InfluxDB({
      host: "localhost",
      database: "getBalance",
      schema: [
        {
          measurement: "mining_report",
          fields: {
            total_in_usd: Influx.FieldType.FLOAT,
            total_in_btc: Influx.FieldType.FLOAT
          },
          tags: ["total"]
        }
      ]
    });
  } else if (step == "reportTicker") {
    return new Influx.InfluxDB({
      host: "localhost",
      database: "getBalance",
      schema: [
        {
          measurement: "mining_report",
          fields: {
            coin_earning: Influx.FieldType.FLOAT,
            total_in_usd: Influx.FieldType.FLOAT,
            total_in_btc: Influx.FieldType.FLOAT
          },
          tags: ["ticker"]
        }
      ]
    });
  } else {
    return new Influx.InfluxDB({
      host: "localhost",
      database: "getBalance",
      schema: [
        {
          measurement: "balances",
          fields: {
            total_balance: Influx.FieldType.FLOAT,
            total_in_usd: Influx.FieldType.FLOAT,
            total_in_btc: Influx.FieldType.FLOAT,
            value_in_btc: Influx.FieldType.FLOAT,
            wallet: Influx.FieldType.FLOAT,
            explorer: Influx.FieldType.FLOAT,
            suprnova: Influx.FieldType.FLOAT,
            ethermine: Influx.FieldType.FLOAT,
            TwoMiners: Influx.FieldType.FLOAT
          },
          tags: ["ticker"]
        }
      ]
    });
  }
}
