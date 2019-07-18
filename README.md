# Crypto_Portfolio

## Installation

```bash
cd Crypto_Portfolio
npm install
```

## Run getBalance

```bash
node app.js <Your_Wallet_File.json>
```

## Run getID

```bash
node getID.js <3_chars_ticker>
```

## Run getBalance in dev mode

```bash
node app.js <Your_Wallet_File.json> dev
```

## How To Config

Follow the included wallets.json template file.  
email: Your email address if you want to receive notifications  
sendgrid_apiKey: Your sendgrid api key if you want to receive notifications  
Both need to be configured to receive emails.

ticker: The 3 characters symbol of the coin (in uppercase)  
address: Your wallet address [value or blank]
manualBalance: If you want to add a balance manually [value]
checkOnExplorer: Check the balance of the wallet on the explorer [true or false]
nanopool: If you are mining on nanopool and want to include the amount currently on it [true or false]  
ethermine: If you are mining on ethermine and want to include the amount currently on it [true or false]  
suprnova:

- apiKey: The api key of your suprnova account if you are mining and want to include the amount currently on it [api_key or blank]

notification_value:

- high: The upper threshold before the system send you a notification [value or blank]
- low: The lower threshold before the system send you a notification [value or blank]

```json
{
  "email": "mg@nOS.com",
  "sendgrid_apiKey": "SG.o8pHoVgynoZKfCLaqb8",
  "wallets": [
    {
      "ticker": "RVN",
      "address": "RJRibeRyGhGFdWmB9V5UevQ5d3iYyABVTA",
      "manualBalance": 0,
      "checkOnExplorer": true,
      "nanopool": false,
      "ethermine": false,
      "suprnova": {
        "apiKey": "972fd45d659a48b15453c673701b23ab3c9f2095b37d925d9cc3aba8a5cb7a06"
      },
      "notification_value": {
        "high": "0.00000850",
        "low": "0.00000450"
      }
    }
  ]
}
```

## To do :

- [x] Refactor the code
- [x] Save all the values in influxDB and add graphana charts
  - Portfolio value over time
    - in BTC (lines)
    - in USD (lines)
  - Coins over time
  - total balance (lines)
  - mined by period (bars)
  - value in BTC (lines)
  - value in USD (lines)
- [ ] Connect to exchanges and buy/sell on threshold
- [ ] Add machine learning ???
- Automatically buy/sell when time comes
