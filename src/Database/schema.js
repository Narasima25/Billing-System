// ═══════════════════════════════════════════════════════════════════════════
//  Database/schema.js — Complete Database Schema & Initialization
//  12 tables covering all POS, inventory, and management modules.
//  All monetary values stored as Paise integers (₹1 = 100 paise).
// ═══════════════════════════════════════════════════════════════════════════

const crypto = require('crypto');

/**
 * Hash a password using SHA-256
 */
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

/**
 * Initialize all database tables and seed data.
 * @param {object} db - better-sqlite3 Database instance
 */
function initializeSchema(db) {
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  // ─── 1. Users Table ──────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','manager','cashier')),
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  // ─── 2. Categories Table ─────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  // ─── 3. Suppliers Table ──────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact_person TEXT DEFAULT '',
      mobile TEXT DEFAULT '',
      email TEXT DEFAULT '',
      gst_number TEXT DEFAULT '',
      address TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  // ─── 4. Products Table ──────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode TEXT UNIQUE NOT NULL,
      product_name TEXT NOT NULL,
      category_id INTEGER,
      brand TEXT DEFAULT '',
      supplier_id INTEGER,
      purchase_price_paise INTEGER DEFAULT 0,
      selling_price_paise INTEGER DEFAULT 0,
      gst_percent REAL DEFAULT 0,
      hsn_code TEXT DEFAULT '',
      stock_quantity INTEGER DEFAULT 0,
      minimum_stock_level INTEGER DEFAULT 5,
      description TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    );
  `);

  // Index for fast barcode lookups
  db.exec(`CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id);`);

  // ─── 5. Product Batches Table ────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS product_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      batch_number TEXT NOT NULL,
      manufacturing_date TEXT,
      expiry_date TEXT,
      quantity INTEGER DEFAULT 0,
      purchase_price_paise INTEGER DEFAULT 0,
      selling_price_paise INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_batches_product ON product_batches(product_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_batches_expiry ON product_batches(expiry_date);`);



  // ─── 7. Sales Table ──────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_number TEXT UNIQUE NOT NULL,
      user_id INTEGER,
      subtotal_paise INTEGER DEFAULT 0,
      discount_paise INTEGER DEFAULT 0,
      cgst_paise INTEGER DEFAULT 0,
      sgst_paise INTEGER DEFAULT 0,
      grand_total_paise INTEGER DEFAULT 0,
      payment_mode TEXT DEFAULT 'cash' CHECK(payment_mode IN ('cash','upi','card')),
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_sales_receipt ON sales(receipt_number);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(created_at);`);

  // ─── 8. Sale Items Table ─────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      barcode TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price_paise INTEGER NOT NULL,
      purchase_price_paise INTEGER DEFAULT 0,
      gst_percent REAL DEFAULT 0,
      hsn_code TEXT DEFAULT '',
      line_total_paise INTEGER NOT NULL,
      batch_id INTEGER,
      FOREIGN KEY (sale_id) REFERENCES sales(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);`);

  // ─── 9. Purchases Table ──────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL,
      invoice_number TEXT DEFAULT '',
      total_paise INTEGER DEFAULT 0,
      notes TEXT DEFAULT '',
      purchase_date TEXT DEFAULT (datetime('now','localtime')),
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    );
  `);

  // ─── 10. Purchase Items Table ────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      unit_cost_paise INTEGER NOT NULL,
      line_total_paise INTEGER NOT NULL,
      FOREIGN KEY (purchase_id) REFERENCES purchases(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
  `);

  // ─── 11. Inventory Adjustments Table ─────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS inventory_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      adjustment_type TEXT NOT NULL CHECK(adjustment_type IN ('add','reduce','stock_in','sale','purchase')),
      quantity INTEGER NOT NULL,
      reason TEXT DEFAULT '',
      user_id INTEGER,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_adjustments_product ON inventory_adjustments(product_id);`);

  // ─── 12. Settings Table ──────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT DEFAULT ''
    );
  `);

  // ─── Migrations for existing DBs ─────────────────────────────────────
  try {
    db.exec(`ALTER TABLE product_batches ADD COLUMN purchase_price_paise INTEGER DEFAULT 0;`);
  } catch(e) { /* Column might already exist */ }
  
  try {
    db.exec(`ALTER TABLE product_batches ADD COLUMN selling_price_paise INTEGER DEFAULT 0;`);
  } catch(e) { /* Column might already exist */ }

  try {
    db.exec(`ALTER TABLE sale_items ADD COLUMN purchase_price_paise INTEGER DEFAULT 0;`);
  } catch(e) { /* Column might already exist */ }

  try {
    db.exec(`ALTER TABLE sale_items ADD COLUMN batch_id INTEGER;`);
  } catch(e) { /* Column might already exist */ }

  try {
    db.exec(`ALTER TABLE sale_items ADD COLUMN hsn_code TEXT DEFAULT '';`);
  } catch(e) { /* Column might already exist */ }

  // ─── Seed: Default Admin User ────────────────────────────────────────
  const adminCheck = db.prepare("SELECT COUNT(*) as cnt FROM users WHERE username = 'admin'").get();
  const adminExists = adminCheck && adminCheck.cnt > 0;

  if (!adminExists) {
    const adminHash = hashPassword('admin123');
    db.prepare(
      "INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)"
    ).run('admin', adminHash, 'Administrator', 'admin');
  }

  // ─── Seed: Default Categories ────────────────────────────────────────
  const catCheck = db.prepare("SELECT COUNT(*) as cnt FROM categories").get();
  const catCount = catCheck ? catCheck.cnt : 0;

  if (catCount === 0) {
    const defaultCategories = [
      ['Dog Food', 'Dry and wet food for dogs'],
      ['Cat Food', 'Dry and wet food for cats'],
      ['Fish Feed', 'Feed and supplements for fish'],
      ['Bird Feed', 'Seeds and feed for birds'],
      ['Pet Medicine', 'Medicines and health supplements'],
      ['Toys', 'Toys and play accessories'],
      ['Accessories', 'Leashes, collars, bowls, beds'],
      ['Grooming Products', 'Shampoos, brushes, grooming tools'],
    ];
    const catStmt = db.prepare("INSERT INTO categories (name, description) VALUES (?, ?)");
    defaultCategories.forEach(cat => { catStmt.run(...cat); });
  }

  // ─── Seed: Default Settings ──────────────────────────────────────────
  const defaultSettings = {
    'store_name': 'PET STORE',
    'store_address': '',
    'store_phone': '',
    'store_gst': '',
    'printer_width': '80',
    'theme': 'light',
    'last_backup': '',
    'receipt_counter': '0',
  };

  const settingStmt = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
  Object.entries(defaultSettings).forEach(([key, value]) => {
    settingStmt.run(key, value);
  });
}

/**
 * Generate the next sequential receipt number: PET-YYYY-NNNNNN
 * @param {object} db - better-sqlite3 Database instance
 * @returns {string} Receipt number
 */
function generateReceiptNumber(db) {
  const year = new Date().getFullYear();

  // Get and increment the counter
  const result = db.prepare("SELECT value FROM settings WHERE key = 'receipt_counter'").get();
  let counter = 0;
  if (result && result.value) {
    counter = parseInt(result.value) || 0;
  }
  counter++;

  db.prepare("UPDATE settings SET value = ? WHERE key = 'receipt_counter'").run(counter.toString());

  const padded = counter.toString().padStart(6, '0');
  return `PET-${year}-${padded}`;
}

module.exports = { initializeSchema, hashPassword, generateReceiptNumber };
