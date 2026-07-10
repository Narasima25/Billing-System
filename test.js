const db = require('better-sqlite3')('pos_store.db');
const fs = require('fs');
const { app } = require('electron');

const counter = db.prepare("SELECT value FROM settings WHERE key='receipt_counter'").get();
const sales = db.prepare("SELECT receipt_number FROM sales ORDER BY id DESC LIMIT 10").all();

fs.writeFileSync('out.json', JSON.stringify({ counter, sales }, null, 2));
app.quit();
