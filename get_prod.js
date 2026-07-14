const Database = require('better-sqlite3');
const db = new Database('d:/Billing-POS/database.sqlite');
const row = db.prepare("SELECT p.stock_quantity, p.barcode, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.product_name LIKE '%grooming%'").get();
console.log(row);
