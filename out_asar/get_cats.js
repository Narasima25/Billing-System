const Database = require('better-sqlite3');
const db = new Database('d:/Billing-POS/database.sqlite');
const rows = db.prepare("SELECT id, name FROM categories").all();
console.log(rows);
