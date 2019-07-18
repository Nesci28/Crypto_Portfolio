module.exports = function(wallets) {
  const keys = [];
  for (let i = 0; i < wallets.length; i++) {
    keys.push(wallets[i].ticker);
  }
  return keys;
};
