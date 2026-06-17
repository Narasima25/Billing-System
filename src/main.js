// ═══════════════════════════════════════════════════════════════════════════
//  main.js — Electron Main Process
//  Pet Store POS & Inventory Management System
//  Handles window creation, database initialization, and 40+ IPC handlers.
// ═══════════════════════════════════════════════════════════════════════════

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { initializeSchema, hashPassword, generateReceiptNumber } = require('./Database/schema');

const dbPath = path.join(__dirname, '../pos_store.db');
let db;

// ─── Database Initialization ────────────────────────────────────────────────
async function startDatabase() {
  db = new Database(dbPath);
  console.log('[DB] Connected to database at', dbPath);
  
  // Run schema to ensure all tables exist (migrations)
  initializeSchema(db);
  console.log('[DB] Database schema verified.');
}

// ─── Helper: Run query and return array of objects ──────────────────────────
function queryAll(sql, params = []) {
  return db.prepare(sql).all(...params);
}

function queryOne(sql, params = []) {
  return db.prepare(sql).get(...params);
}

function runSql(sql, params = []) {
  return db.prepare(sql).run(...params);
}

// ─── Window Creation ────────────────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width: 1366,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'Pet Store POS System',
    backgroundColor: '#0f172a',
    icon: path.join(__dirname, 'Assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.loadFile(path.join(__dirname, 'index.html'));
  win.maximize();
}

app.whenReady().then(async () => {
  await startDatabase();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ═══════════════════════════════════════════════════════════════════════════
//  IPC HANDLERS — Organized by Module
// ═══════════════════════════════════════════════════════════════════════════

// ─── AUTH ────────────────────────────────────────────────────────────────────

ipcMain.handle('auth:login', async (_e, { username, password }) => {
  try {
    const hash = hashPassword(password);
    const user = queryOne(
      "SELECT id, username, display_name, role FROM users WHERE username = ? AND password_hash = ? AND is_active = 1",
      [username, hash]
    );
    if (user) {
      return { success: true, user };
    }
    return { success: false, error: 'Invalid username or password' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('auth:get-users', async () => {
  try {
    return queryAll("SELECT id, username, display_name, role, is_active, created_at FROM users ORDER BY id");
  } catch (err) {
    return [];
  }
});

ipcMain.handle('auth:create-user', async (_e, { username, password, displayName, role }) => {
  try {
    const hash = hashPassword(password);
    runSql(
      "INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)",
      [username, hash, displayName, role]
    );
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('auth:update-user', async (_e, { id, username, displayName, role, password, isActive }) => {
  try {
    if (password) {
      const hash = hashPassword(password);
      runSql("UPDATE users SET username=?, display_name=?, role=?, password_hash=?, is_active=?, updated_at=datetime('now','localtime') WHERE id=?",
        [username, displayName, role, hash, isActive ? 1 : 0, id]);
    } else {
      runSql("UPDATE users SET username=?, display_name=?, role=?, is_active=?, updated_at=datetime('now','localtime') WHERE id=?",
        [username, displayName, role, isActive ? 1 : 0, id]);
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('auth:delete-user', async (_e, id) => {
  try {
    runSql("UPDATE users SET is_active = 0 WHERE id = ?", [id]);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ─── CATEGORIES ──────────────────────────────────────────────────────────────

ipcMain.handle('categories:get-all', async () => {
  try {
    return queryAll("SELECT * FROM categories ORDER BY name");
  } catch (err) {
    return [];
  }
});

ipcMain.handle('categories:add', async (_e, { name, description }) => {
  try {
    runSql("INSERT INTO categories (name, description) VALUES (?, ?)", [name, description || '']);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('categories:update', async (_e, { id, name, description }) => {
  try {
    runSql("UPDATE categories SET name=?, description=? WHERE id=?", [name, description || '', id]);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('categories:delete', async (_e, id) => {
  try {
    const products = queryOne("SELECT COUNT(*) as cnt FROM products WHERE category_id = ?", [id]);
    if (products && products.cnt > 0) {
      return { success: false, error: `Cannot delete: ${products.cnt} products use this category` };
    }
    runSql("DELETE FROM categories WHERE id = ?", [id]);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ─── SUPPLIERS ───────────────────────────────────────────────────────────────

ipcMain.handle('suppliers:get-all', async () => {
  try {
    return queryAll("SELECT * FROM suppliers WHERE is_active = 1 ORDER BY name");
  } catch (err) {
    return [];
  }
});

ipcMain.handle('suppliers:add', async (_e, data) => {
  try {
    runSql(
      "INSERT INTO suppliers (name, contact_person, mobile, email, gst_number, address) VALUES (?, ?, ?, ?, ?, ?)",
      [data.name, data.contactPerson || '', data.mobile || '', data.email || '', data.gstNumber || '', data.address || '']
    );
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('suppliers:update', async (_e, data) => {
  try {
    runSql(
      "UPDATE suppliers SET name=?, contact_person=?, mobile=?, email=?, gst_number=?, address=?, updated_at=datetime('now','localtime') WHERE id=?",
      [data.name, data.contactPerson || '', data.mobile || '', data.email || '', data.gstNumber || '', data.address || '', data.id]
    );
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('suppliers:delete', async (_e, id) => {
  try {
    runSql("UPDATE suppliers SET is_active = 0 WHERE id = ?", [id]);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('suppliers:get-purchases', async (_e, supplierId) => {
  try {
    return queryAll(
      "SELECT p.*, (SELECT COUNT(*) FROM purchase_items WHERE purchase_id = p.id) as item_count FROM purchases p WHERE p.supplier_id = ? ORDER BY p.created_at DESC",
      [supplierId]
    );
  } catch (err) {
    return [];
  }
});

// ─── PRODUCTS ────────────────────────────────────────────────────────────────

ipcMain.handle('products:get-all', async (_e, { search, categoryId, supplierId, page, perPage } = {}) => {
  try {
    let sql = `SELECT p.*, c.name as category_name, s.name as supplier_name
               FROM products p
               LEFT JOIN categories c ON p.category_id = c.id
               LEFT JOIN suppliers s ON p.supplier_id = s.id
               WHERE p.is_active = 1`;
    const params = [];

    if (search) {
      sql += " AND (p.product_name LIKE ? OR p.barcode LIKE ? OR p.brand LIKE ?)";
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (categoryId) {
      sql += " AND p.category_id = ?";
      params.push(categoryId);
    }
    if (supplierId) {
      sql += " AND (p.supplier_id = ? OR p.id IN (SELECT pi.product_id FROM purchase_items pi JOIN purchases pu ON pi.purchase_id = pu.id WHERE pu.supplier_id = ?))";
      params.push(supplierId, supplierId);
    }

    // Count for pagination
    const countSql = sql.replace(/SELECT p\.\*.*FROM/, 'SELECT COUNT(*) as total FROM');
    const countResult = queryOne(countSql, params);
    const total = countResult ? countResult.total : 0;

    sql += " ORDER BY p.product_name";

    const pg = page || 1;
    const pp = perPage || 20;
    const offset = (pg - 1) * pp;
    sql += ` LIMIT ${pp} OFFSET ${offset}`;

    const products = queryAll(sql, params);
    return { products, total, page: pg, perPage: pp };
  } catch (err) {
    console.error('[IPC] products:get-all error:', err);
    return { products: [], total: 0, page: 1, perPage: 20 };
  }
});

ipcMain.handle('products:lookup-barcode', async (_e, barcode) => {
  try {
    return queryOne(
      `SELECT p.*, c.name as category_name, s.name as supplier_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       WHERE p.barcode = ? AND p.is_active = 1`,
      [barcode]
    );
  } catch (err) {
    return null;
  }
});

ipcMain.handle('products:add', async (_e, data) => {
  try {
    // Check barcode uniqueness
    const existing = queryOne("SELECT id FROM products WHERE barcode = ?", [data.barcode]);
    if (existing) {
      return { success: false, error: 'Barcode already exists' };
    }

    runSql(
      `INSERT INTO products (barcode, product_name, category_id, brand, supplier_id,
        purchase_price_paise, selling_price_paise, gst_percent, hsn_code,
        stock_quantity, minimum_stock_level, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.barcode, data.productName, data.categoryId || null, data.brand || '',
        data.supplierId || null, data.purchasePricePaise ?? 0, data.sellingPricePaise ?? 0,
        data.gstPercent ?? 0, data.hsnCode || '', data.stockQuantity ?? 0,
        data.minimumStockLevel ?? 5, data.description || ''
      ]
    );

    const newProduct = queryOne("SELECT id FROM products WHERE barcode = ?", [data.barcode]);

    if (newProduct) {
      if (data.stockQuantity > 0) {
        runSql(
          "INSERT INTO inventory_adjustments (product_id, adjustment_type, quantity, reason) VALUES (?, 'add', ?, 'Initial Stock')",
          [newProduct.id, data.stockQuantity]
        );
      }

      if (data.batchNumber || data.expiryDate) {
        runSql(
          "INSERT INTO product_batches (product_id, batch_number, expiry_date, quantity, purchase_price_paise, selling_price_paise) VALUES (?, ?, ?, ?, ?, ?)",
          [newProduct.id, data.batchNumber || ('B-INIT-' + Date.now().toString().slice(-4)), data.expiryDate || '', data.stockQuantity || 0, data.purchasePricePaise ?? 0, data.sellingPricePaise ?? 0]
        );
      }
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('products:update', async (_e, data) => {
  try {
    runSql(
      `UPDATE products SET product_name=?, category_id=?, brand=?, supplier_id=?,
        purchase_price_paise=?, selling_price_paise=?, gst_percent=?, hsn_code=?,
        minimum_stock_level=?, description=?, updated_at=datetime('now','localtime')
       WHERE id=?`,
      [
        data.productName, data.categoryId || null, data.brand || '',
        data.supplierId || null, data.purchasePricePaise ?? 0, data.sellingPricePaise ?? 0,
        data.gstPercent ?? 0, data.hsnCode || '', data.minimumStockLevel ?? 5,
        data.description || '', data.id
      ]
    );

    if (data.batchNumber || data.expiryDate) {
      if (data.batchNumber) {
        const existingBatch = queryOne("SELECT id FROM product_batches WHERE product_id = ? AND batch_number = ?", [data.id, data.batchNumber]);
        if (existingBatch) {
          runSql("UPDATE product_batches SET expiry_date = ? WHERE id = ?", [data.expiryDate || '', existingBatch.id]);
        } else {
          const prod = queryOne("SELECT stock_quantity, purchase_price_paise, selling_price_paise FROM products WHERE id = ?", [data.id]);
          runSql("INSERT INTO product_batches (product_id, batch_number, expiry_date, quantity, purchase_price_paise, selling_price_paise) VALUES (?, ?, ?, ?, ?, ?)",
            [data.id, data.batchNumber, data.expiryDate || '', prod ? prod.stock_quantity : 0, prod ? prod.purchase_price_paise : 0, prod ? prod.selling_price_paise : 0]);
        }
      } else {
        const latestBatch = queryOne("SELECT id FROM product_batches WHERE product_id = ? ORDER BY id DESC LIMIT 1", [data.id]);
        if (latestBatch) {
          runSql("UPDATE product_batches SET expiry_date = ? WHERE id = ?", [data.expiryDate || '', latestBatch.id]);
        } else {
          const prod = queryOne("SELECT stock_quantity, purchase_price_paise, selling_price_paise FROM products WHERE id = ?", [data.id]);
          runSql("INSERT INTO product_batches (product_id, batch_number, expiry_date, quantity, purchase_price_paise, selling_price_paise) VALUES (?, ?, ?, ?, ?, ?)",
            [data.id, 'B-' + Date.now().toString().slice(-4), data.expiryDate || '', prod ? prod.stock_quantity : 0, prod ? prod.purchase_price_paise : 0, prod ? prod.selling_price_paise : 0]);
        }
      }
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('products:delete', async (_e, id) => {
  try {
    runSql("UPDATE products SET is_active = 0 WHERE id = ?", [id]);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});



// ─── INVENTORY ───────────────────────────────────────────────────────────────

ipcMain.handle('inventory:stock-in', async (_e, { barcode, quantity, userId, batchNumber, expiryDate, purchasePricePaise, sellingPricePaise }) => {
  try {
    const product = queryOne("SELECT * FROM products WHERE barcode = ? AND is_active = 1", [barcode]);
    if (!product) return { success: false, error: 'Product not found' };

    runSql("UPDATE products SET stock_quantity = stock_quantity + ?, updated_at=datetime('now','localtime') WHERE id = ?",
      [quantity, product.id]);

    runSql(
      "INSERT INTO inventory_adjustments (product_id, adjustment_type, quantity, reason, user_id) VALUES (?, 'stock_in', ?, 'Stock In via barcode scan', ?)",
      [product.id, quantity, userId || null]
    );

    if (batchNumber || expiryDate) {
      runSql(
        "INSERT INTO product_batches (product_id, batch_number, expiry_date, quantity, purchase_price_paise, selling_price_paise) VALUES (?, ?, ?, ?, ?, ?)",
        [product.id, batchNumber || ('B-' + Date.now().toString().slice(-4)), expiryDate || '', quantity, purchasePricePaise ?? product.purchase_price_paise, sellingPricePaise ?? product.selling_price_paise]
      );
    }

    const updated = queryOne("SELECT * FROM products WHERE id = ?", [product.id]);
    return { success: true, product: updated };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('inventory:adjust', async (_e, { productId, type, quantity, reason, userId }) => {
  try {
    if (type === 'add') {
      runSql("UPDATE products SET stock_quantity = stock_quantity + ?, updated_at=datetime('now','localtime') WHERE id = ?",
        [quantity, productId]);
    } else {
      // Check current stock
      const product = queryOne("SELECT stock_quantity FROM products WHERE id = ?", [productId]);
      if (!product || product.stock_quantity < quantity) {
        return { success: false, error: 'Insufficient stock for reduction' };
      }
      runSql("UPDATE products SET stock_quantity = stock_quantity - ?, updated_at=datetime('now','localtime') WHERE id = ?",
        [quantity, productId]);
    }

    runSql(
      "INSERT INTO inventory_adjustments (product_id, adjustment_type, quantity, reason, user_id) VALUES (?, ?, ?, ?, ?)",
      [productId, type, quantity, reason || '', userId || null]
    );

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('inventory:get-adjustments', async (_e, { productId, page, perPage } = {}) => {
  try {
    let sql = `SELECT ia.*, p.product_name, p.barcode, u.display_name as user_name
               FROM inventory_adjustments ia
               LEFT JOIN products p ON ia.product_id = p.id
               LEFT JOIN users u ON ia.user_id = u.id`;
    const params = [];

    if (productId) {
      sql += " WHERE ia.product_id = ?";
      params.push(productId);
    }

    sql += " ORDER BY ia.created_at DESC";

    const pg = page || 1;
    const pp = perPage || 20;
    sql += ` LIMIT ${pp} OFFSET ${(pg - 1) * pp}`;

    return queryAll(sql, params);
  } catch (err) {
    return [];
  }
});

ipcMain.handle('inventory:audit-data', async () => {
  try {
    return queryAll(
      `SELECT id, barcode, product_name, stock_quantity, minimum_stock_level
       FROM products WHERE is_active = 1 ORDER BY product_name`
    );
  } catch (err) {
    return [];
  }
});

// ─── BATCHES ─────────────────────────────────────────────────────────────────

ipcMain.handle('batches:add', async (_e, { productId, batchNumber, manufacturingDate, expiryDate, quantity, purchasePricePaise, sellingPricePaise }) => {
  try {
    runSql(
      "INSERT INTO product_batches (product_id, batch_number, manufacturing_date, expiry_date, quantity, purchase_price_paise, selling_price_paise) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [productId, batchNumber, manufacturingDate || '', expiryDate || '', quantity || 0, purchasePricePaise ?? 0, sellingPricePaise ?? 0]
    );
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('batches:get-by-product', async (_e, productId) => {
  try {
    return queryAll("SELECT * FROM product_batches WHERE product_id = ? ORDER BY expiry_date", [productId]);
  } catch (err) {
    return [];
  }
});

ipcMain.handle('batches:get-all', async (_e) => {
  try {
    return queryAll(
      `SELECT pb.*, p.product_name, p.barcode
       FROM product_batches pb
       JOIN products p ON pb.product_id = p.id
       WHERE pb.expiry_date != ''
       ORDER BY pb.expiry_date`
    );
  } catch (err) {
    return [];
  }
});

ipcMain.handle('batches:get-expiring', async (_e, daysAhead) => {
  try {
    const days = daysAhead || 30;
    return queryAll(
      `SELECT pb.*, p.product_name, p.barcode
       FROM product_batches pb
       JOIN products p ON pb.product_id = p.id
       WHERE pb.expiry_date != '' AND pb.expiry_date <= date('now', '+' || ? || ' days')
       ORDER BY pb.expiry_date`,
      [days]
    );
  } catch (err) {
    return [];
  }
});

// ─── BILLING / CHECKOUT ──────────────────────────────────────────────────────

ipcMain.handle('billing:checkout', async (_e, { cartItems, paymentMode, discountPaise, userId }) => {
  try {
    // cartItems = [{ productId, barcode, productName, quantity, unitPricePaise, gstPercent }]
    let subtotalPaise = 0;
    let totalCgstPaise = 0;
    let totalSgstPaise = 0;

    // Validate stock
    for (const item of cartItems) {
      const product = queryOne("SELECT stock_quantity FROM products WHERE id = ? AND is_active = 1", [item.productId]);
      if (!product) return { success: false, error: `Product ${item.productName} not found` };
      if (product.stock_quantity < item.quantity) {
        return { success: false, error: `Insufficient stock for ${item.productName} (available: ${product.stock_quantity})` };
      }
    }

    // Calculate totals
    for (const item of cartItems) {
      const lineTotal = item.unitPricePaise * item.quantity;
      subtotalPaise += lineTotal;

      if (item.gstPercent > 0) {
        const gstAmount = Math.round(lineTotal * item.gstPercent / 100);
        const halfGst = Math.round(gstAmount / 2);
        totalCgstPaise += halfGst;
        totalSgstPaise += halfGst;
      }
    }

    const discount = discountPaise || 0;
    const grandTotalPaise = subtotalPaise + totalCgstPaise + totalSgstPaise - discount;

    // Generate receipt number
    const receiptNumber = generateReceiptNumber(db);

    // Insert sale
    const { lastInsertRowid: saleId } = db.prepare(
      `INSERT INTO sales (receipt_number, user_id, subtotal_paise, discount_paise,
        cgst_paise, sgst_paise, grand_total_paise, payment_mode)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      receiptNumber, userId || null, subtotalPaise, discount,
      totalCgstPaise, totalSgstPaise, grandTotalPaise, paymentMode || 'cash'
    );

    // Insert sale items and deduct stock
    for (const item of cartItems) {
      // Deduct inventory
      db.prepare("UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?").run(
        item.quantity, item.productId
      );

      // Log adjustment
      db.prepare(
        "INSERT INTO inventory_adjustments (product_id, adjustment_type, quantity, reason, user_id) VALUES (?, 'sale', ?, ?, ?)"
      ).run(
        item.productId, item.quantity, `Sale ${receiptNumber}`, userId || null
      );

      let remainingQuantityToDeduct = item.quantity;
      
      // Fetch batches ordered by expiry (oldest expiring first), then creation date
      const batches = db.prepare(`
        SELECT * FROM product_batches 
        WHERE product_id = ? AND quantity > 0 
        ORDER BY 
          CASE WHEN expiry_date != '' THEN expiry_date ELSE '9999-12-31' END ASC, 
          created_at ASC
      `).all(item.productId);
      
      let batchIndex = 0;
      
      while (remainingQuantityToDeduct > 0) {
        let batchId = null;
        let batchPurchasePrice = 0; // Fallback to 0 if no batches
        let qtyToDeductFromBatch = remainingQuantityToDeduct;
        
        if (batchIndex < batches.length) {
          const batch = batches[batchIndex];
          batchId = batch.id;
          batchPurchasePrice = batch.purchase_price_paise;
          
          if (batch.quantity >= remainingQuantityToDeduct) {
            // This batch can fulfill the remaining amount
            db.prepare("UPDATE product_batches SET quantity = quantity - ? WHERE id = ?").run(remainingQuantityToDeduct, batch.id);
            qtyToDeductFromBatch = remainingQuantityToDeduct;
            remainingQuantityToDeduct = 0;
          } else {
            // This batch can only partially fulfill
            qtyToDeductFromBatch = batch.quantity;
            db.prepare("UPDATE product_batches SET quantity = 0 WHERE id = ?").run(batch.id);
            remainingQuantityToDeduct -= qtyToDeductFromBatch;
            batchIndex++;
          }
        } else {
          // We ran out of batches before fulfilling the quantity!
          // We will fallback to the product's default purchase price
          const prod = db.prepare("SELECT purchase_price_paise FROM products WHERE id = ?").get(item.productId);
          batchPurchasePrice = prod ? prod.purchase_price_paise : 0;
          qtyToDeductFromBatch = remainingQuantityToDeduct;
          remainingQuantityToDeduct = 0;
        }
        
        const lineTotalPart = qtyToDeductFromBatch * item.unitPricePaise;
        
        db.prepare(
          `INSERT INTO sale_items (sale_id, product_id, product_name, barcode, quantity, unit_price_paise, purchase_price_paise, gst_percent, hsn_code, line_total_paise, batch_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          saleId, item.productId, item.productName, item.barcode, qtyToDeductFromBatch, 
          item.unitPricePaise, batchPurchasePrice, item.gstPercent || 0, item.hsnCode || '', lineTotalPart, batchId
        );
      }
    }

    console.log(`[TX] Sale ${receiptNumber} — ₹${(grandTotalPaise / 100).toFixed(2)}`);

    return {
      success: true,
      receiptNumber,
      saleId,
      subtotalPaise,
      cgstPaise: totalCgstPaise,
      sgstPaise: totalSgstPaise,
      discountPaise: discount,
      grandTotalPaise,
    };
  } catch (err) {
    console.error('[IPC] billing:checkout error:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('billing:get-sale', async (_e, saleId) => {
  try {
    const sale = queryOne("SELECT * FROM sales WHERE id = ?", [saleId]);
    if (!sale) return null;

    sale.items = queryAll("SELECT * FROM sale_items WHERE sale_id = ?", [saleId]);
    return sale;
  } catch (err) {
    return null;
  }
});

ipcMain.handle('billing:get-recent-sales', async (_e, limit) => {
  try {
    return queryAll("SELECT * FROM sales ORDER BY created_at DESC LIMIT ?", [limit || 10]);
  } catch (err) {
    return [];
  }
});

ipcMain.handle('billing:get-last-sale', async () => {
  try {
    const sale = queryOne("SELECT * FROM sales ORDER BY id DESC LIMIT 1");
    if (!sale) return null;
    sale.items = queryAll("SELECT * FROM sale_items WHERE sale_id = ?", [sale.id]);
    return sale;
  } catch (err) {
    return null;
  }
});

// ─── PURCHASES ───────────────────────────────────────────────────────────────

ipcMain.handle('purchases:add', async (_e, { supplierId, invoiceNumber, items, notes }) => {
  try {
    // items = [{ productId, quantity, unitCostPaise }]
    let totalPaise = 0;
    for (const item of items) {
      totalPaise += item.unitCostPaise * item.quantity;
    }

    const { lastInsertRowid: purchaseId } = db.prepare(
      "INSERT INTO purchases (supplier_id, invoice_number, total_paise, notes) VALUES (?, ?, ?, ?)"
    ).run(supplierId, invoiceNumber || '', totalPaise, notes || '');

    for (const item of items) {
      const lineTotal = item.unitCostPaise * item.quantity;
      db.prepare(
        "INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_cost_paise, line_total_paise) VALUES (?, ?, ?, ?, ?)"
      ).run(purchaseId, item.productId, item.quantity, item.unitCostPaise, lineTotal);

      // Increase inventory
      db.prepare("UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?").run(
        item.quantity, item.productId
      );

      // Log adjustment
      db.prepare(
        "INSERT INTO inventory_adjustments (product_id, adjustment_type, quantity, reason) VALUES (?, 'purchase', ?, ?)"
      ).run(
        item.productId, item.quantity, `Purchase Invoice: ${invoiceNumber || purchaseId}`
      );

      // Create batch
      db.prepare(
        "INSERT INTO product_batches (product_id, batch_number, expiry_date, quantity, purchase_price_paise, selling_price_paise) VALUES (?, ?, ?, ?, ?, (SELECT selling_price_paise FROM products WHERE id = ?))"
      ).run(
        item.productId,
        'P-' + (invoiceNumber || purchaseId) + '-' + Date.now().toString().slice(-4),
        '',
        item.quantity,
        item.unitCostPaise,
        item.productId
      );
    }

    return { success: true, purchaseId };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('purchases:get-all', async (_e, { page, perPage } = {}) => {
  try {
    const pg = page || 1;
    const pp = perPage || 20;
    const purchases = queryAll(
      `SELECT p.*, s.name as supplier_name,
        (SELECT COUNT(*) FROM purchase_items WHERE purchase_id = p.id) as item_count
       FROM purchases p
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [pp, (pg - 1) * pp]
    );
    const countResult = queryOne("SELECT COUNT(*) as total FROM purchases");
    return { purchases, total: countResult ? countResult.total : 0 };
  } catch (err) {
    return { purchases: [], total: 0 };
  }
});

// ─── DASHBOARD ───────────────────────────────────────────────────────────────

ipcMain.handle('dashboard:get-stats', async () => {
  try {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;

    const todaySales = queryOne(
      "SELECT COALESCE(SUM(grand_total_paise), 0) as total, COUNT(*) as cnt FROM sales WHERE date(created_at) = ?",
      [todayStr]
    );

    const monthlySales = queryOne(
      "SELECT COALESCE(SUM(grand_total_paise), 0) as total, COUNT(*) as cnt FROM sales WHERE created_at >= ?",
      [monthStart]
    );

    const totalRevenue = queryOne(
      "SELECT COALESCE(SUM(grand_total_paise), 0) as total FROM sales"
    );

    const totalProducts = queryOne("SELECT COUNT(*) as cnt FROM products WHERE is_active = 1");

    const totalInventory = queryOne(
      "SELECT COALESCE(SUM(stock_quantity), 0) as total FROM products WHERE is_active = 1"
    );

    const lowStock = queryOne(
      "SELECT COUNT(*) as cnt FROM products WHERE is_active = 1 AND stock_quantity > 0 AND stock_quantity <= minimum_stock_level"
    );

    const outOfStock = queryOne(
      "SELECT COUNT(*) as cnt FROM products WHERE is_active = 1 AND stock_quantity = 0"
    );

    const recentSales = queryAll(
      "SELECT * FROM sales ORDER BY created_at DESC LIMIT 10"
    );

    // Expiry alerts
    const expiring30 = queryAll(
      `SELECT pb.*, p.product_name FROM product_batches pb
       JOIN products p ON pb.product_id = p.id
       WHERE pb.expiry_date != '' AND pb.expiry_date <= date('now', '+30 days') AND pb.expiry_date > date('now')
       ORDER BY pb.expiry_date LIMIT 10`
    );

    const expired = queryAll(
      `SELECT pb.*, p.product_name FROM product_batches pb
       JOIN products p ON pb.product_id = p.id
       WHERE pb.expiry_date != '' AND pb.expiry_date <= date('now')
       ORDER BY pb.expiry_date DESC LIMIT 10`
    );

    return {
      todaySalesPaise: todaySales ? todaySales.total : 0,
      todaySalesCount: todaySales ? todaySales.cnt : 0,
      monthlySalesPaise: monthlySales ? monthlySales.total : 0,
      monthlySalesCount: monthlySales ? monthlySales.cnt : 0,
      totalRevenuePaise: totalRevenue ? totalRevenue.total : 0,
      totalProducts: totalProducts ? totalProducts.cnt : 0,
      totalInventory: totalInventory ? totalInventory.total : 0,
      lowStockCount: lowStock ? lowStock.cnt : 0,
      outOfStockCount: outOfStock ? outOfStock.cnt : 0,
      recentSales,
      expiring30,
      expired,
    };
  } catch (err) {
    console.error('[IPC] dashboard error:', err);
    return {};
  }
});

// ─── REPORTS ─────────────────────────────────────────────────────────────────

ipcMain.handle('reports:sales', async (_e, { startDate, endDate, paymentMode }) => {
  try {
    let salesQuery = `SELECT s.*, u.display_name as cashier_name,
        (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) as item_count
       FROM sales s
       LEFT JOIN users u ON s.user_id = u.id
       WHERE date(s.created_at) >= ? AND date(s.created_at) <= ?`;

    let summaryQuery = `SELECT COUNT(*) as total_sales,
        COALESCE(SUM(subtotal_paise), 0) as total_subtotal,
        COALESCE(SUM(discount_paise), 0) as total_discount,
        COALESCE(SUM(cgst_paise), 0) as total_cgst,
        COALESCE(SUM(sgst_paise), 0) as total_sgst,
        COALESCE(SUM(grand_total_paise), 0) as total_grand
       FROM sales WHERE date(created_at) >= ? AND date(created_at) <= ?`;

    const params = [startDate, endDate];

    if (paymentMode && paymentMode !== 'all') {
      salesQuery += ` AND s.payment_mode = ?`;
      summaryQuery += ` AND payment_mode = ?`;
      params.push(paymentMode);
    }

    salesQuery += ` ORDER BY s.created_at DESC`;

    const sales = queryAll(salesQuery, params);
    const summary = queryOne(summaryQuery, params);

    return { sales, summary };
  } catch (err) {
    return { sales: [], summary: null };
  }
});

ipcMain.handle('reports:inventory', async (_e, { filter }) => {
  try {
    let sql = `SELECT p.*, c.name as category_name
               FROM products p LEFT JOIN categories c ON p.category_id = c.id
               WHERE p.is_active = 1`;

    if (filter === 'low') {
      sql += " AND p.stock_quantity > 0 AND p.stock_quantity <= p.minimum_stock_level";
    } else if (filter === 'out') {
      sql += " AND p.stock_quantity = 0";
    }

    sql += " ORDER BY p.stock_quantity ASC";
    return queryAll(sql);
  } catch (err) {
    return [];
  }
});

ipcMain.handle('reports:purchases', async (_e, { startDate, endDate, supplierId }) => {
  try {
    let sql = `SELECT p.*, s.name as supplier_name
               FROM purchases p
               LEFT JOIN suppliers s ON p.supplier_id = s.id
               WHERE 1=1`;
    const params = [];

    if (startDate && endDate) {
      sql += " AND date(p.purchase_date) >= ? AND date(p.purchase_date) <= ?";
      params.push(startDate, endDate);
    }
    if (supplierId) {
      sql += " AND p.supplier_id = ?";
      params.push(supplierId);
    }

    sql += " ORDER BY p.created_at DESC";
    return queryAll(sql, params);
  } catch (err) {
    return [];
  }
});

ipcMain.handle('reports:profit', async (_e, { startDate, endDate }) => {
  try {
    // Get all sale items in range with their cost prices
    const items = queryAll(
      `SELECT si.quantity, si.unit_price_paise, si.line_total_paise,
              CASE WHEN si.purchase_price_paise > 0 THEN si.purchase_price_paise ELSE p.purchase_price_paise END as actual_cost_paise
       FROM sale_items si
       JOIN sales s ON si.sale_id = s.id
       JOIN products p ON si.product_id = p.id
       WHERE date(s.created_at) >= ? AND date(s.created_at) <= ?`,
      [startDate, endDate]
    );

    let totalRevenue = 0;
    let totalCost = 0;

    items.forEach(item => {
      totalRevenue += item.line_total_paise;
      totalCost += item.actual_cost_paise * item.quantity;
    });

    const totalProfit = totalRevenue - totalCost;
    const profitPercent = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0;

    return {
      totalRevenuePaise: totalRevenue,
      totalCostPaise: totalCost,
      totalProfitPaise: totalProfit,
      profitPercent,
      itemCount: items.length,
    };
  } catch (err) {
    return { totalRevenuePaise: 0, totalCostPaise: 0, totalProfitPaise: 0, profitPercent: 0, itemCount: 0 };
  }
});

// ─── SETTINGS ────────────────────────────────────────────────────────────────

ipcMain.handle('settings:get', async (_e, key) => {
  try {
    const result = queryOne("SELECT value FROM settings WHERE key = ?", [key]);
    return result ? result.value : null;
  } catch (err) {
    return null;
  }
});

ipcMain.handle('settings:get-all', async () => {
  try {
    const rows = queryAll("SELECT * FROM settings");
    const settings = {};
    rows.forEach(row => { settings[row.key] = row.value; });
    return settings;
  } catch (err) {
    return {};
  }
});

ipcMain.handle('settings:set', async (_e, { key, value }) => {
  try {
    runSql("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [key, value]);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ─── BACKUP ──────────────────────────────────────────────────────────────────

ipcMain.handle('backup:export', async () => {
  try {
    const backupData = await db.backup('backup.db');
    // Read the backup file
    const data = fs.readFileSync('backup.db');
    const base64 = data.toString('base64');
    
    // Clean up temporary backup file
    fs.unlinkSync('backup.db');
    
    // Update last backup time
    runSql("INSERT OR REPLACE INTO settings (key, value) VALUES ('last_backup', ?)",
      [new Date().toISOString()]);
      
    return { success: true, data: base64, size: data.length };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('backup:import', async (_e, base64Data) => {
  try {
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Close the current connection
    db.close();
    
    // Replace the database file
    fs.writeFileSync(dbPath, buffer);
    
    // Reopen the database
    db = new Database(dbPath);
    
    // Quick validity check
    db.prepare("SELECT COUNT(*) FROM products").get();
    
    return { success: true };
  } catch (err) {
    // If it fails, try to reopen the old one if it still exists
    try {
      db = new Database(dbPath);
    } catch (e) {
      // Best effort recovery
    }
    return { success: false, error: 'Invalid database file: ' + err.message };
  }
});