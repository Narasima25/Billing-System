const db = require('better-sqlite3')('pos_store.db');
const fs = require('fs');
const { app } = require('electron');
const { generateReceiptNumber } = require('./src/Database/schema');

try {
  let counter_before = db.prepare("SELECT value FROM settings WHERE key='receipt_counter'").get();
  
  // Call generateReceiptNumber inside a transaction like checkout does!
  const checkoutTransaction = db.transaction(() => {
     return generateReceiptNumber(db, '10-07-2026');
  });
  const res = checkoutTransaction();
  
  let counter_after = db.prepare("SELECT value FROM settings WHERE key='receipt_counter'").get();
  
  fs.writeFileSync('out2.json', JSON.stringify({ counter_before, counter_after, result: res }, null, 2));
} catch(e) {
  fs.writeFileSync('out2.json', JSON.stringify({ error: e.message }));
}
app.quit();
