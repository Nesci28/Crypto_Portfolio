const monk = require("monk");
require("dotenv").config();

// MongoDB Connection
const db = monk(
  `${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_URL}`
);
const collection = db.get(`${process.env.DB_COLLECTION}`);
const miningCollection = db.get(`${process.env.DB_COLLECTION2}`);

exports.mongoBalance = function(balance) {
  collection.update(
    { _id: 1 },
    { $set: { balance: balance } },
    { upsert: true }
  );
};

exports.mongoReport = function(report) {
  miningCollection.update(
    { _id: 1 },
    { $push: { mining_history: report } },
    { upsert: true }
  );
};
