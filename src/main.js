// ═══════════════════════════════════════════════════════════════════════════
//  main.js — Electron Main Process
//  Pet Store POS & Inventory Management System
//  Handles window creation, database initialization, and 40+ IPC handlers.
// ═══════════════════════════════════════════════════════════════════════════// ═══════════════════════════════════════════════════════════════════════════

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');

// Hardware acceleration is ENABLED by default to prevent UI lag on large DOM tables.
// Removed the 'disable-gpu' flags which force CPU rendering and cause 30-min freezes.

const { autoUpdater } = require('electron-updater');

autoUpdater.on('error', (err) => {
  console.error('Updater Error:', err);
  if (mainWindow) mainWindow.webContents.send('updater:error', err.message);
});

autoUpdater.on('update-available', () => {
  console.log('Update available.');
  if (mainWindow) mainWindow.webContents.send('updater:available');
});
autoUpdater.on('update-not-available', () => {
  console.log('Update not available.');
  if (mainWindow) mainWindow.webContents.send('updater:not-available');
});
autoUpdater.on('download-progress', (progressObj) => {
  if (mainWindow) mainWindow.webContents.send('updater:progress', progressObj);
});
autoUpdater.on('update-downloaded', () => {
  console.log('Update downloaded. Prompting user to install.');
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Ready',
    message: 'A new version has been downloaded. Restart the application to apply the updates.',
    buttons: ['Restart', 'Later']
  }).then((result) => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});

ipcMain.handle('updater:check', () => {
  if (!app.isPackaged) {
    console.log('Running in Dev Mode: Mocking updater check...');
    setTimeout(() => {
      if (mainWindow) mainWindow.webContents.send('updater:not-available');
    }, 1500);
    return;
  }
  autoUpdater.checkForUpdatesAndNotify();
});
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const { initializeSchema, hashPassword, generateReceiptNumber } = require('./Database/schema');
const { sendWhatsAppReceipt, sendWhatsAppUpdate, sendWhatsAppBulkUpdate } = require('./whatsappService');

const isDev = !app.isPackaged;
const dbDir = isDev ? path.join(__dirname, '..') : app.getPath('userData');
const dbPath = path.join(dbDir, 'pos_store.db');
let db;

// ─── Database Initialization ────────────────────────────────────────────────
async function startDatabase() {
  try {
    db = new Database(dbPath);
    console.log('[DB] Connected to database at', dbPath);

    // Run WAL integrity check on startup — catches corruption from unclean shutdown
    const walCheck = db.pragma('integrity_check');
    if (walCheck[0]?.integrity_check !== 'ok') {
      console.error('[DB] INTEGRITY CHECK FAILED:', walCheck);
    }

    // Run schema to ensure all tables exist (migrations)
    initializeSchema(db);
    console.log('[DB] Database schema verified.');
  } catch (err) {
    console.error('[DB] FATAL: Failed to initialize database:', err);
    dialog.showErrorBox('Database Error',
      `Failed to open the database file.\n\n${err.message}\n\nPath: ${dbPath}\n\nThe app will now close.`);
    app.quit();
  }
}

// ─── Helper: Run query and return array of objects ──────────────────────────
function queryAll(sql, params = []) {
  if (!db || !db.open) throw new Error('Database is not open');
  return db.prepare(sql).all(...params);
}

function queryOne(sql, params = []) {
  if (!db || !db.open) throw new Error('Database is not open');
  return db.prepare(sql).get(...params);
}

function runSql(sql, params = []) {
  if (!db || !db.open) throw new Error('Database is not open');
  return db.prepare(sql).run(...params);
}

function getHardwareId() {
  try {
    if (process.platform === 'win32') {
      const output = execSync('powershell.exe -Command "(Get-CimInstance -Class Win32_ComputerSystemProduct).UUID"');
      return output.toString().trim();
    } else if (process.platform === 'linux') {
      if (fs.existsSync('/etc/machine-id')) {
        return fs.readFileSync('/etc/machine-id', 'utf8').trim();
      } else if (fs.existsSync('/var/lib/dbus/machine-id')) {
        return fs.readFileSync('/var/lib/dbus/machine-id', 'utf8').trim();
      }
    } else if (process.platform === 'darwin') {
      const output = execSync('ioreg -rd1 -c IOPlatformExpertDevice | awk \'/IOPlatformUUID/ { split($0, line, "\\""); printf("%s\\n", line[4]); }\'');
      return output.toString().trim();
    }
    return 'UNKNOWN-PLATFORM-ID';
  } catch (err) {
    console.error('Failed to get hardware ID:', err);
    return 'UNKNOWN-HARDWARE-ID';
  }
}

// ─── License Checking ───────────────────────────────────────────────────────
function checkLicense() {
  try {
    const hardwareId = getHardwareId();
    const secretSalt = "BillingPosSecretKey2026!";
    const currentMachineHash = crypto.createHash('sha256')
      .update(hardwareId + secretSalt)
      .digest('hex');

    const licensePath = path.join(app.getPath('userData'), 'license.key');
    if (!fs.existsSync(licensePath)) return false;
    
    const storedKey = fs.readFileSync(licensePath, 'utf8').trim();
    return storedKey === currentMachineHash;
  } catch (err) {
    return false;
  }
}
let mainWindow;
function createWindow() {
  const isLicensed = checkLicense();
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'Pet Store POS System',
    backgroundColor: '#0f172a',
    icon: path.join(__dirname, 'logo.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false, // Fixes severe typing lag on Windows (especially with low-end CPUs)
      backgroundThrottling: true, // Allow throttling when minimized to save CPU
      enableRemoteModule: false,
    },
  });

  // Security Hardening: Prevent opening new windows (e.g. from target="_blank")
  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  if (isLicensed) {
    mainWindow.loadFile(path.join(__dirname, 'index.html'));
    mainWindow.maximize();
  } else {
    // Load your locked alert screen
    mainWindow.loadFile(path.join(__dirname, 'locked.html'));
  }

  mainWindow.webContents.on('did-finish-load', () => {
    // Inject the client's Hardware ID dynamically into the locked.html screen
    mainWindow.webContents.executeJavaScript(`
      if(document.getElementById('machine-id')) {
          document.getElementById('machine-id').innerText = "${getHardwareId()}";
      }
    `);

    // Check for updates AFTER the UI has loaded so the IPC messages aren't lost
    if (isLicensed) {
      setTimeout(() => {
        try {
          if (!app.isPackaged) {
            console.log("Skipping auto-update check on startup in dev mode.");
            return;
          }
          autoUpdater.checkForUpdatesAndNotify();
        } catch (err) {
          console.error("AutoUpdater Check Error:", err);
        }
      }, 3000);
    }
  });
}

app.whenReady().then(async () => {
  await startDatabase();
  createWindow();
});

// ─── Global Error Handlers — prevent silent crashes ──────────────────────────
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled Promise Rejection:', reason);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Bug fix #15: Properly close database on app quit to prevent WAL file corruption
app.on('will-quit', () => {
  try {
    if (db && db.open) db.close();
    console.log('[DB] Database connection closed cleanly.');
    
    // Create an automated background backup after closing the database
    performAutoBackup();
  } catch (err) {
    console.error('[DB] Error closing database:', err);
  }
});

/**
 * Creates an automatic local backup of the database and retains only the last 10 backups.
 * Designed to run synchronously during app shutdown.
 */
function performAutoBackup() {
  try {
    const backupDir = path.join(app.getPath('userData'), 'AutoBackups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `pos_backup_${timestamp}.db`;
    const backupFilePath = path.join(backupDir, backupFileName);

    // Copy the cleanly closed database file
    fs.copyFileSync(dbPath, backupFilePath);
    console.log(`[BACKUP] Auto-backup created: ${backupFileName}`);

    // Enforce retention limit (keep last 10)
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('pos_backup_') && f.endsWith('.db'))
      .map(f => ({ name: f, path: path.join(backupDir, f), time: fs.statSync(path.join(backupDir, f)).mtime.getTime() }))
      .sort((a, b) => b.time - a.time); // Newest first

    if (files.length > 10) {
      const toDelete = files.slice(10);
      for (const file of toDelete) {
        try { fs.unlinkSync(file.path); } catch(e) {}
        console.log(`[BACKUP] Deleted old auto-backup: ${file.name}`);
      }
    }
  } catch (err) {
    console.error('[BACKUP] Auto-backup failed:', err);
  }
}

// ─── FILE PICKER / ATTACHMENT ────────────────────────────────────────────────

ipcMain.handle('dialog:open-file', async (_e, options = {}) => {
  try {
    const result = await dialog.showOpenDialog({
      title: options.title || 'Select File',
      filters: options.filters || [
        { name: 'Documents', extensions: ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx', 'xls', 'xlsx'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }
    const sourcePath = result.filePaths[0];
    const fileName = path.basename(sourcePath);
    // Copy file to app's attachments directory
    const attachDir = path.join(dbDir, 'attachments');
    if (!fs.existsSync(attachDir)) fs.mkdirSync(attachDir, { recursive: true });
    const destName = Date.now() + '_' + fileName;
    const destPath = path.join(attachDir, destName);
    fs.copyFileSync(sourcePath, destPath);
    return { success: true, filePath: destPath, fileName: fileName };
  } catch (err) {
    return { success: false, error: err.message };
  }
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
      [username || '', hash, displayName || '', role || 'cashier']
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
        [username || '', displayName || '', role || 'cashier', hash, isActive ? 1 : 0, id]);
    } else {
      runSql("UPDATE users SET username=?, display_name=?, role=?, is_active=?, updated_at=datetime('now','localtime') WHERE id=?",
        [username || '', displayName || '', role || 'cashier', isActive ? 1 : 0, id]);
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
    // Wrapped in transaction: if DELETE fails, the NULL update is rolled back
    const deleteCat = db.transaction((catId) => {
      runSql("UPDATE products SET category_id = NULL WHERE category_id = ?", [catId]);
      runSql("DELETE FROM categories WHERE id = ?", [catId]);
    });
    deleteCat(id);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ─── SUPPLIERS ───────────────────────────────────────────────────────────────

ipcMain.handle('suppliers:get-all', async (_e, options = {}) => {
  try {
    if (options && options.includeInactive) {
      return queryAll(`
        SELECT s.*, 
          GROUP_CONCAT(p.invoice_number) as invoice_numbers,
          (
            SELECT COALESCE(SUM(pr.stock_quantity * pr.purchase_price_paise), 0)
            FROM products pr
            WHERE pr.supplier_id = s.id AND pr.stock_quantity > 0 AND pr.is_active = 1
          ) as current_stock_value_paise
        FROM suppliers s 
        LEFT JOIN purchases p ON s.id = p.supplier_id 
        GROUP BY s.id 
        ORDER BY s.is_active DESC, s.name ASC
      `);
    }
    return queryAll(`
      SELECT s.*, 
        GROUP_CONCAT(p.invoice_number) as invoice_numbers,
        (
          SELECT COALESCE(SUM(pr.stock_quantity * pr.purchase_price_paise), 0)
          FROM products pr
          WHERE pr.supplier_id = s.id AND pr.stock_quantity > 0 AND pr.is_active = 1
        ) as current_stock_value_paise
      FROM suppliers s 
      LEFT JOIN purchases p ON s.id = p.supplier_id 
      WHERE s.is_active = 1 
      GROUP BY s.id 
      ORDER BY s.name ASC
    `);
  } catch (err) {
    return [];
  }
});

ipcMain.handle('suppliers:add', async (_e, data) => {
  try {
    runSql(
      "INSERT INTO suppliers (name, contact_person, mobile, email, gst_number, address, state) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [data.name, data.contactPerson || '', data.mobile || '', data.email || '', data.gstNumber || '', data.address || '', data.state || '']
    );
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('suppliers:update', async (_e, data) => {
  try {
    runSql(
      "UPDATE suppliers SET name=?, contact_person=?, mobile=?, email=?, gst_number=?, address=?, state=?, updated_at=datetime('now','localtime') WHERE id=?",
      [data.name, data.contactPerson || '', data.mobile || '', data.email || '', data.gstNumber || '', data.address || '', data.state || '', data.id]
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

ipcMain.handle('suppliers:hard-delete', async (_e, id) => {
  try {
    // Wrapped in transaction: if DELETE fails, the NULL update is rolled back
    const deleteSupplier = db.transaction((suppId) => {
      runSql("UPDATE products SET supplier_id = NULL WHERE supplier_id = ?", [suppId]);

      const purCount = queryOne("SELECT COUNT(*) as cnt FROM purchases WHERE supplier_id = ?", [suppId]);
      if (purCount && purCount.cnt > 0) {
        runSql("UPDATE suppliers SET contact_person = '', mobile = '', email = '', gst_number = '', address = '', is_active = 0 WHERE id = ?", [suppId]);
        return;
      }

      runSql("DELETE FROM suppliers WHERE id = ?", [suppId]);
    });
    deleteSupplier(id);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('suppliers:restore', async (_e, id) => {
  try {
    runSql("UPDATE suppliers SET is_active = 1 WHERE id = ?", [id]);
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

ipcMain.handle('suppliers:get-ledger', async (_e, monthStr) => {
  try {
    let itcQuery = "SELECT SUM(gst_paid_paise) as total_itc FROM purchases WHERE status != 'Draft'";
    let duesQuery = "SELECT SUM(total_paise - amount_paid_paise) as total_dues FROM purchases WHERE status IN ('Partially Paid', 'Credit/Pending')";
    let returnsItcQuery = "SELECT SUM(total_gst_paise) as return_itc FROM purchase_returns WHERE 1=1";
    const params = [];
    const returnsParams = [];

    if (monthStr) {
      itcQuery += " AND strftime('%Y-%m', purchase_date) = ?";
      duesQuery += " AND strftime('%Y-%m', purchase_date) = ?";
      returnsItcQuery += " AND strftime('%Y-%m', return_date) = ?";
      params.push(monthStr);
      returnsParams.push(monthStr);
    }

    const itcRow = queryOne(itcQuery, params);
    const duesRow = queryOne(duesQuery, params);
    
    // Purchase Returns GST reduces the ITC
    let returnItc = 0;
    try {
      const returnsItcRow = queryOne(returnsItcQuery, returnsParams);
      returnItc = returnsItcRow?.return_itc || 0;
    } catch(err) {
      // Table might not be migrated yet or exist
    }

    return {
      success: true,
      itcPaise: (itcRow?.total_itc || 0) - returnItc,
      duesPaise: duesRow?.total_dues || 0
    };
  } catch (err) {
    console.error('Ledger Error:', err);
    return { success: false, itcPaise: 0, duesPaise: 0 };
  }
});

// ─── PRODUCTS ────────────────────────────────────────────────────────────────

ipcMain.handle('products:get-batches', async (_e, productId) => {
  try {
    return queryAll("SELECT * FROM product_batches WHERE product_id = ? AND quantity > 0 ORDER BY id ASC", [productId]);
  } catch (err) {
    return [];
  }
});

ipcMain.handle('products:get-all', async (_e, { search, categoryId, supplierId, stockFilter, page, perPage } = {}) => {
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
    if (stockFilter === 'out') {
      sql += " AND p.stock_quantity <= 0";
    } else if (stockFilter === 'low') {
      sql += " AND p.stock_quantity > 0 AND p.stock_quantity <= p.minimum_stock_level";
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
    // Check barcode uniqueness, allowing reactivation of deleted products
    const existing = queryOne("SELECT id, is_active FROM products WHERE barcode = ?", [data.barcode]);
    if (existing && existing.is_active === 1) {
      return { success: false, error: 'Barcode already exists' };
    }

    // Wrapped in transaction: if batch/adjustment insert fails, the product insert is rolled back
    const addProduct = db.transaction(() => {
      if (existing && existing.is_active === 0) {
        runSql(
          `UPDATE products SET is_active = 1, product_name = ?, category_id = ?, brand = ?, supplier_id = ?,
           base_price_paise = ?, scheme_discount_paise = ?, purchase_price_paise = ?, selling_price_paise = ?, gst_percent = ?, hsn_code = ?,
           stock_quantity = ?, minimum_stock_level = ?, description = ?, updated_at = datetime('now','localtime')
           WHERE id = ?`,
          [
            data.productName, data.categoryId || null, data.brand || '',
            data.supplierId || null, data.basePricePaise ?? 0, data.schemeDiscountPaise ?? 0,
            data.purchasePricePaise ?? 0, data.sellingPricePaise ?? 0,
            data.gstPercent ?? 0, data.hsnCode || '', data.stockQuantity ?? 0,
            data.minimumStockLevel ?? 5, data.description || '', existing.id
          ]
        );
      } else {
        runSql(
          `INSERT INTO products (barcode, product_name, category_id, brand, supplier_id,
            base_price_paise, scheme_discount_paise, purchase_price_paise, selling_price_paise, gst_percent, hsn_code,
            stock_quantity, minimum_stock_level, description)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            data.barcode, data.productName, data.categoryId || null, data.brand || '',
            data.supplierId || null, data.basePricePaise ?? 0, data.schemeDiscountPaise ?? 0,
            data.purchasePricePaise ?? 0, data.sellingPricePaise ?? 0,
            data.gstPercent ?? 0, data.hsnCode || '', data.stockQuantity ?? 0,
            data.minimumStockLevel ?? 5, data.description || ''
          ]
        );
      }

      const newProduct = existing || queryOne("SELECT id FROM products WHERE barcode = ?", [data.barcode]);

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
    });
    addProduct();

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('products:update', async (_e, data) => {
  try {
    if (!data || !data.id) {
      return { success: false, error: 'Product ID is missing' };
    }
    // Wrapped in transaction: if batch/adjustment write fails, product update is rolled back
    const updateProduct = db.transaction(() => {
      const existingProduct = queryOne("SELECT stock_quantity FROM products WHERE id = ?", [data.id]);
      
      runSql(
        `UPDATE products SET product_name=?, category_id=?, brand=?, supplier_id=?,
          base_price_paise=?, scheme_discount_paise=?, purchase_price_paise=?, selling_price_paise=?, gst_percent=?, hsn_code=?,
          minimum_stock_level=?, stock_quantity=?, description=?, updated_at=datetime('now','localtime')
         WHERE id=?`,
        [
          data.productName, data.categoryId || null, data.brand || '',
          data.supplierId || null, data.basePricePaise ?? 0, data.schemeDiscountPaise ?? 0,
          data.purchasePricePaise ?? 0, data.sellingPricePaise ?? 0,
          data.gstPercent ?? 0, data.hsnCode || '', data.minimumStockLevel ?? 5, data.stockQuantity ?? 0,
          data.description || '', data.id
        ]
      );

      if (existingProduct) {
        const oldStock = existingProduct.stock_quantity || 0;
        const newStock = data.stockQuantity || 0;
        const diff = newStock - oldStock;
        
        if (diff !== 0) {
          const type = diff > 0 ? 'add' : 'reduce';
          runSql(
            "INSERT INTO inventory_adjustments (product_id, adjustment_type, quantity, reason) VALUES (?, ?, ?, 'Direct Edit')",
            [data.id, type, Math.abs(diff)]
          );
        }
      }

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
      } else if (data.batchNumber === '' && data.expiryDate === '') {
        const latestBatch = queryOne("SELECT id FROM product_batches WHERE product_id = ? ORDER BY id DESC LIMIT 1", [data.id]);
        if (latestBatch) {
          runSql("UPDATE product_batches SET expiry_date = '' WHERE id = ?", [latestBatch.id]);
        }
      }
    });
    updateProduct();

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

    // Wrapped in transaction: stock, adjustment, and batch must all succeed or all roll back
    const stockInTx = db.transaction(() => {
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
    });
    stockInTx();

    const updated = queryOne("SELECT * FROM products WHERE id = ?", [product.id]);
    return { success: true, product: updated };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('inventory:adjust', async (_e, { productId, type, quantity, reason, userId }) => {
  try {
    const prod = queryOne("SELECT stock_quantity, purchase_price_paise, selling_price_paise FROM products WHERE id = ?", [productId]);
    if (!prod) return { success: false, error: 'Product not found' };

    if (type !== 'add') {
      // Check current stock before starting transaction
      if (prod.stock_quantity < quantity) {
        return { success: false, error: 'Insufficient stock for reduction' };
      }
    }

    // Wrapped in transaction: stock, batches, and adjustment must all succeed or all roll back
    const adjustTx = db.transaction(() => {
      if (type === 'add') {
        runSql("UPDATE products SET stock_quantity = stock_quantity + ?, updated_at=datetime('now','localtime') WHERE id = ?",
          [quantity, productId]);
          
        // Add a default batch for this manual addition
        runSql("INSERT INTO product_batches (product_id, batch_number, expiry_date, quantity, purchase_price_paise, selling_price_paise) VALUES (?, ?, ?, ?, ?, ?)",
          [productId, 'ADJ-' + Date.now().toString().slice(-4), '', quantity, prod.purchase_price_paise, prod.selling_price_paise]);

      } else {
        runSql("UPDATE products SET stock_quantity = stock_quantity - ?, updated_at=datetime('now','localtime') WHERE id = ?",
          [quantity, productId]);
          
        // Deduct from batches using FIFO logic
        let remainingQtyToDeduct = quantity;
        const batches = db.prepare(`
          SELECT * FROM product_batches 
          WHERE product_id = ? AND quantity > 0 
          ORDER BY 
            CASE WHEN expiry_date != '' THEN expiry_date ELSE '9999-12-31' END ASC, 
            created_at ASC
        `).all(productId);

        for (const batch of batches) {
          if (remainingQtyToDeduct <= 0) break;
          if (batch.quantity >= remainingQtyToDeduct) {
            runSql("UPDATE product_batches SET quantity = quantity - ? WHERE id = ?", [remainingQtyToDeduct, batch.id]);
            remainingQtyToDeduct = 0;
          } else {
            remainingQtyToDeduct -= batch.quantity;
            runSql("UPDATE product_batches SET quantity = 0 WHERE id = ?", [batch.id]);
          }
        }
      }

      runSql(
        "INSERT INTO inventory_adjustments (product_id, adjustment_type, quantity, reason, user_id) VALUES (?, ?, ?, ?, ?)",
        [productId, type, quantity, reason || '', userId || null]
      );
    });
    adjustTx();

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
       WHERE pb.expiry_date != '' AND p.is_active = 1
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
       WHERE pb.expiry_date != '' AND pb.expiry_date <= date('now', '+' || ? || ' days') AND p.is_active = 1
       ORDER BY pb.expiry_date`,
      [days]
    );
  } catch (err) {
    return [];
  }
});

// ─── BILLING / CHECKOUT ──────────────────────────────────────────────────────

ipcMain.handle('billing:get-customer', async (_e, phone) => {
  try {
    const cust = queryOne("SELECT * FROM customers WHERE phone_number = ?", [phone]);
    return { success: true, customer: cust || null };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('customers:get-all', async () => {
  try {
    return queryAll("SELECT * FROM customers ORDER BY created_at DESC");
  } catch (err) {
    return [];
  }
});

ipcMain.handle('customers:get-history', async (_e, phone) => {
  try {
    return queryAll("SELECT * FROM sales WHERE customer_phone = ? ORDER BY created_at DESC", [phone]);
  } catch (err) {
    return [];
  }
});

ipcMain.handle('customers:send-update', async (_e, { phone, customerName, messageText }) => {
  try {
    return await sendWhatsAppUpdate(phone, customerName, messageText);
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('customers:send-bulk-update', async (_e, { recipients, messageText }) => {
  try {
    return await sendWhatsAppBulkUpdate(recipients, messageText);
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('customers:update-joined-date', async (_e, { phone, dateStr }) => {
  try {
    if (!phone || !dateStr) return { success: false, error: 'Phone and date are required' };
    const cust = queryOne("SELECT id, created_at FROM customers WHERE phone_number = ?", [phone]);
    if (!cust) return { success: false, error: 'Customer not found' };
    // Preserve the time portion, only update the date
    const oldTime = cust.created_at ? cust.created_at.split(' ')[1] || '00:00:00' : '00:00:00';
    const newCreatedAt = `${dateStr} ${oldTime}`;
    runSql("UPDATE customers SET created_at = ?, updated_at = datetime('now','localtime') WHERE id = ?", [newCreatedAt, cust.id]);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('billing:get-next-receipt-number', async (_e, dateStr) => {
  try {
    const dateObj = dateStr ? new Date(dateStr) : new Date();
    const year = dateObj.getFullYear();
    const result = db.prepare("SELECT value FROM settings WHERE key = 'receipt_counter'").get();
    let counter = (result && result.value) ? parseInt(result.value) || 0 : 0;

    // Self-heal: ensure counter is at least as high as the max existing receipt number
    const prefix = `PET-${year}-`;
    const maxExisting = db.prepare(
      "SELECT receipt_number FROM sales WHERE receipt_number LIKE ? AND length(receipt_number) < 15 ORDER BY receipt_number DESC LIMIT 1"
    ).get(prefix + '%');
    if (maxExisting) {
      const existingNum = parseInt(maxExisting.receipt_number.replace(prefix, '')) || 0;
      if (existingNum > counter) {
        counter = existingNum;
      }
    }

    counter++;
    
    let receiptNumber;
    let maxRetries = 100;
    while (maxRetries-- > 0) {
      const padded = counter.toString().padStart(3, '0');
      receiptNumber = `PET-${year}-${padded}`;
      const exists = db.prepare("SELECT 1 FROM sales WHERE receipt_number = ?").get(receiptNumber);
      if (!exists) break;
      counter++;
    }
    
    return receiptNumber;
  } catch (err) {
    return 'Auto Generated';
  }
});

ipcMain.handle('billing:checkout', async (_e, { cartItems, paymentMode, discountPaise, userId, customerName, customerGstin, isB2B, isInterState, customerStateCode, customerPhone, customerAddress, appliedCouponPaise, invoiceDate, sendWhatsappReceipt: shouldSendWhatsappReceipt }) => {
  try {
    const checkoutTransaction = db.transaction((items) => {
      // 1. Initial Stock Validation
      for (const item of items) {
        const freeQuantity = parseInt(item.freeQuantity) || 0;
        const totalQuantityToDeduct = item.quantity + freeQuantity;
        const product = db.prepare("SELECT p.stock_quantity, p.barcode, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ? AND p.is_active = 1").get(item.productId);
        if (!product) throw new Error(`Product ${item.productName} not found`);
        const isService = (product.category_name || '').toLowerCase().includes('service') || (product.category_name || '').toLowerCase().includes('grooming') || (product.barcode || '').startsWith('SRV-');
        item._isService = isService;
        if (!isService && product.stock_quantity < totalQuantityToDeduct) {
          throw new Error(`Insufficient stock for ${item.productName} (available: ${product.stock_quantity})`);
        }
      }

      // 2. Global Totals (to calculate Loyalty)
      let totalGrossPaise = 0;
      
      for (const item of items) {
        const itemDiscount = parseInt(item.discountPaise) || 0;
        const itemGross = Math.max(0, (item.unitPricePaise * item.quantity) - itemDiscount);
        item._itemGross = itemGross; // cache it
        totalGrossPaise += itemGross;
      }

      const globalDiscount = discountPaise || 0;
      let globalGrandTotal = totalGrossPaise - globalDiscount;

      // 3. Loyalty Logic on Global Grand Total
      let customerId = null;
      let rewardEarnedPaise = 0;
      let newCouponBalancePaise = 0;
      let actualAppliedCoupon = 0;
      const isB2CSmall = !isB2B && (globalGrandTotal <= 25000000);

      if (customerPhone && isB2CSmall) {
        let cust = db.prepare("SELECT * FROM customers WHERE phone_number = ?").get(customerPhone);
        if (!cust) {
          const res = db.prepare("INSERT INTO customers (phone_number, name, created_at, updated_at) VALUES (?, ?, datetime('now','localtime'), datetime('now','localtime'))").run(customerPhone, customerName || '');
          customerId = res.lastInsertRowid;
          cust = { id: customerId, coupon_balance_paise: 0, total_lifetime_spent_paise: 0 };
        } else {
          customerId = cust.id;
          if (customerName && cust.name === '') {
            db.prepare("UPDATE customers SET name = ? WHERE id = ?").run(customerName, customerId);
          }
        }
        if (appliedCouponPaise > 0) {
          actualAppliedCoupon = Math.min(appliedCouponPaise, cust.coupon_balance_paise, globalGrandTotal);
          globalGrandTotal -= actualAppliedCoupon;
        }
        if (globalGrandTotal >= 100000) { // 1000 rupees
          rewardEarnedPaise = Math.floor(globalGrandTotal * 0.01);
        }
        db.prepare(
          "UPDATE customers SET coupon_balance_paise = MAX(0, coupon_balance_paise - ? + ?), total_lifetime_spent_paise = total_lifetime_spent_paise + ?, updated_at = datetime('now','localtime') WHERE id = ?"
        ).run(actualAppliedCoupon, rewardEarnedPaise, globalGrandTotal, customerId);
        newCouponBalancePaise = cust.coupon_balance_paise - actualAppliedCoupon + rewardEarnedPaise;
      } else {
        if (appliedCouponPaise > 0) {
           actualAppliedCoupon = Math.min(appliedCouponPaise, globalGrandTotal);
           globalGrandTotal -= actualAppliedCoupon;
        }
      }

      // 4. Split Carts
      const productCart = items.filter(i => !i._isService);
      const serviceCart = items.filter(i => i._isService);
      
      const cartsToProcess = [];
      if (productCart.length > 0) {
        let pTotal = 0;
        productCart.forEach(item => { pTotal += item._itemGross; });
        const pDiscount = totalGrossPaise > 0 ? Math.round((pTotal / totalGrossPaise) * globalDiscount) : 0;
        const pCoupon = totalGrossPaise > 0 ? Math.round((pTotal / totalGrossPaise) * actualAppliedCoupon) : 0;
        cartsToProcess.push({ items: productCart, discount: pDiscount, coupon: pCoupon, customReceiptNumber: null, isServiceCart: false, cartGross: pTotal });
      }

      if (serviceCart.length > 0) {
        let sTotal = 0;
        serviceCart.forEach(item => { sTotal += item._itemGross; });
        let finalSDiscount = totalGrossPaise > 0 ? Math.round((sTotal / totalGrossPaise) * globalDiscount) : 0;
        let finalSCoupon = totalGrossPaise > 0 ? Math.round((sTotal / totalGrossPaise) * actualAppliedCoupon) : 0;
        
        if (productCart.length > 0) {
           finalSDiscount = globalDiscount - cartsToProcess[0].discount;
           finalSCoupon = actualAppliedCoupon - cartsToProcess[0].coupon;
        }
        cartsToProcess.push({ items: serviceCart, discount: finalSDiscount, coupon: finalSCoupon, customReceiptNumber: null, isServiceCart: true, cartGross: sTotal });
      }

      // 5. Process Each Cart
      const results = [];
      let createdAtStr = null;
      if (invoiceDate) {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        const sec = String(now.getSeconds()).padStart(2, '0');
        createdAtStr = `${invoiceDate} ${hh}:${min}:${sec}`;
      } else {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        const sec = String(now.getSeconds()).padStart(2, '0');
        createdAtStr = `${yyyy}-${mm}-${dd} ${hh}:${min}:${sec}`;
      }

      for (const cart of cartsToProcess) {
        let subtotalPaise = 0;
        let totalCgstPaise = 0;
        let totalSgstPaise = 0;
        let totalIgstPaise = 0;

        const cartGlobalDiscount = cart.discount + cart.coupon;

        for (const item of cart.items) {
          const proportion = cart.cartGross > 0 ? (item._itemGross / cart.cartGross) : 0;
          const itemGlobalDiscount = Math.round(proportion * cartGlobalDiscount);
          item._itemGlobalDiscount = itemGlobalDiscount; // cache it for sale_items insertion
          const lineTotalAfterGlobalDisc = Math.max(0, item._itemGross - itemGlobalDiscount);

          if (item.gstPercent > 0) {
            const taxableValue = Math.round((lineTotalAfterGlobalDisc * 100) / (100 + item.gstPercent));
            const gstAmount = lineTotalAfterGlobalDisc - taxableValue;
            subtotalPaise += taxableValue;
            if (isInterState) {
              totalIgstPaise += gstAmount;
            } else {
              const halfGst = Math.round(gstAmount / 2);
              totalCgstPaise += halfGst;
              totalSgstPaise += (gstAmount - halfGst);
            }
          } else {
            subtotalPaise += lineTotalAfterGlobalDisc;
          }
        }

        const grandTotalPaise = subtotalPaise + totalCgstPaise + totalSgstPaise + totalIgstPaise;
        const receiptNumber = cart.customReceiptNumber || generateReceiptNumber(db, invoiceDate, cart.isServiceCart);
        
        // Only report the reward earned on the primary cart (e.g. the first one) to not duplicate on UI
        const isFirstCart = results.length === 0;
        const reportedReward = isFirstCart ? rewardEarnedPaise : 0;
        const reportedNewBalance = isFirstCart ? newCouponBalancePaise : 0;

        const { lastInsertRowid: saleId } = db.prepare(
          `INSERT INTO sales (receipt_number, user_id, customer_name, customer_gstin, is_b2b, subtotal_paise, discount_paise,
            cgst_paise, sgst_paise, igst_paise, is_inter_state, customer_state_code, grand_total_paise, payment_mode, customer_phone, customer_address, applied_coupon_paise, reward_earned_paise, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          receiptNumber, userId || null, customerName || '', customerGstin || '', isB2B ? 1 : 0, subtotalPaise, cart.discount,
          totalCgstPaise, totalSgstPaise, totalIgstPaise, isInterState ? 1 : 0, customerStateCode || '', grandTotalPaise, paymentMode || 'cash',
          customerPhone || '', customerAddress || '', cart.coupon, reportedReward, createdAtStr
        );

        for (const item of cart.items) {
          const freeQuantity = parseInt(item.freeQuantity) || 0;
          const totalQuantityToDeduct = item.quantity + freeQuantity;

          if (!item._isService) {
            db.prepare("UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?").run(
              totalQuantityToDeduct, item.productId
            );
            db.prepare(
              "INSERT INTO inventory_adjustments (product_id, adjustment_type, quantity, reason, user_id) VALUES (?, 'sale', ?, ?, ?)"
            ).run(
              item.productId, totalQuantityToDeduct, `Sale ${receiptNumber}`, userId || null
            );
          }

          let remainingQuantityToDeduct = totalQuantityToDeduct;
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
            let batchPurchasePrice = 0;
            let qtyToDeductFromBatch = remainingQuantityToDeduct;

            if (batchIndex < batches.length) {
              const batch = batches[batchIndex];
              batchId = batch.id;
              batchPurchasePrice = batch.purchase_price_paise;

              if (batch.quantity >= remainingQuantityToDeduct) {
                db.prepare("UPDATE product_batches SET quantity = quantity - ? WHERE id = ?").run(remainingQuantityToDeduct, batch.id);
                qtyToDeductFromBatch = remainingQuantityToDeduct;
                remainingQuantityToDeduct = 0;
              } else {
                qtyToDeductFromBatch = batch.quantity;
                db.prepare("UPDATE product_batches SET quantity = 0 WHERE id = ?").run(batch.id);
                remainingQuantityToDeduct -= qtyToDeductFromBatch;
                batchIndex++;
              }
            } else {
              const prod = db.prepare("SELECT purchase_price_paise FROM products WHERE id = ?").get(item.productId);
              batchPurchasePrice = prod ? prod.purchase_price_paise : 0;
              qtyToDeductFromBatch = remainingQuantityToDeduct;
              remainingQuantityToDeduct = 0;
            }

            const baseItemDiscount = parseInt(item.discountPaise) || 0;
            const globalAllocatedDiscount = item._itemGlobalDiscount || 0;
            const totalItemDiscount = baseItemDiscount + globalAllocatedDiscount;
            
            const isFirstBatch = (qtyToDeductFromBatch === totalQuantityToDeduct) || (remainingQuantityToDeduct === (totalQuantityToDeduct - qtyToDeductFromBatch));
            const appliedDiscount = isFirstBatch ? totalItemDiscount : 0;
            const appliedFreeQty = isFirstBatch ? freeQuantity : 0;

            const billedQtyForBatch = Math.max(0, qtyToDeductFromBatch - appliedFreeQty);
            const lineTotalPart = billedQtyForBatch * item.unitPricePaise;

            db.prepare(
              `INSERT INTO sale_items (sale_id, product_id, product_name, barcode, quantity, free_quantity, unit_price_paise, purchase_price_paise, discount_paise, gst_percent, hsn_code, line_total_paise, batch_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).run(
              saleId, item.productId, item.productName, item.barcode, billedQtyForBatch, appliedFreeQty,
              item.unitPricePaise, batchPurchasePrice, appliedDiscount, item.gstPercent || 0, item.hsnCode || '', lineTotalPart - appliedDiscount, batchId
            );
          }
        }
        
        results.push({
          receiptNumber,
          saleId,
          subtotalPaise,
          cgstPaise: totalCgstPaise,
          sgstPaise: totalSgstPaise,
          igstPaise: totalIgstPaise,
          discountPaise: cart.discount,
          appliedCouponPaise: cart.coupon,
          rewardEarnedPaise: reportedReward,
          newCouponBalancePaise: reportedNewBalance,
          grandTotalPaise,
          customerName,
          customerGstin,
          customerPhone: customerPhone || '',
          isB2B,
          isInterState,
          createdAt: createdAtStr,
          cartItems: cart.items
        });
      }

      return { success: true, results };
    });

    const result = checkoutTransaction(cartItems);

    if (result.success && customerPhone && shouldSendWhatsappReceipt) {
      for (const res of result.results) {
         sendWhatsAppReceipt(customerPhone, customerName, res.grandTotalPaise, res.receiptNumber).catch(e => console.error("WhatsApp Async Error:", e));
      }
    }

    return result;
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

ipcMain.handle('billing:delete-sale', async (_e, saleId) => {
  try {
    const deleteSaleTransaction = db.transaction((id) => {
      const sale = db.prepare("SELECT * FROM sales WHERE id = ?").get(id);
      if (!sale) throw new Error('Sale not found');

      // 1. Restore inventory from sale items
      const saleItems = db.prepare("SELECT * FROM sale_items WHERE sale_id = ?").all(id);
      for (const item of saleItems) {
        const product = db.prepare("SELECT c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?").get(item.product_id);
        const isService = product && ((product.category_name || '').toLowerCase().includes('service') || (item.barcode || '').startsWith('SRV-'));

        if (!isService) {
          const freeQty = item.free_quantity || 0;
          const totalQuantityToRestore = item.quantity + freeQty;

          if (totalQuantityToRestore > 0) {
            // Restore product stock
            db.prepare("UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?").run(totalQuantityToRestore, item.product_id);

            // Restore batch quantity if applicable
            if (item.batch_id) {
              db.prepare("UPDATE product_batches SET quantity = quantity + ? WHERE id = ?").run(totalQuantityToRestore, item.batch_id);
            }

            // Log inventory adjustment
            db.prepare(
              "INSERT INTO inventory_adjustments (product_id, adjustment_type, quantity, reason) VALUES (?, 'add', ?, ?)"
            ).run(item.product_id, totalQuantityToRestore, `Sale Deleted: ${sale.receipt_number}`);
          }
        }
      }

      // 2. Reverse loyalty rewards if customer had phone
      if (sale.customer_phone) {
        const cust = db.prepare("SELECT * FROM customers WHERE phone_number = ?").get(sale.customer_phone);
        if (cust) {
          const rewardEarned = sale.reward_earned_paise || 0;
          const appliedCoupon = sale.applied_coupon_paise || 0;
          const grandTotal = sale.grand_total_paise || 0;

          // Reverse: remove earned reward, refund applied coupon, reduce lifetime spend
          db.prepare(
            "UPDATE customers SET coupon_balance_paise = MAX(0, coupon_balance_paise - ? + ?), total_lifetime_spent_paise = MAX(0, total_lifetime_spent_paise - ?), updated_at = datetime('now','localtime') WHERE id = ?"
          ).run(rewardEarned, appliedCoupon, grandTotal, cust.id);
        }
      }

      // 3. Delete sale items and the sale record
      db.prepare("DELETE FROM sale_items WHERE sale_id = ?").run(id);
      db.prepare("DELETE FROM sales WHERE id = ?").run(id);

      // 4. Clean up related inventory adjustments
      // (Inventory adjustments for the original sale are intentionally kept to preserve accurate historical auditing. The 'add' adjustment above offsets it.)

      return { success: true, receiptNumber: sale.receipt_number };
    });

    const result = deleteSaleTransaction(saleId);
    return result;
  } catch (err) {
    console.error('[IPC] billing:delete-sale error:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('billing:get-sale-for-return', async (_e, receiptNum) => {
  try {
    const sale = queryOne("SELECT * FROM sales WHERE receipt_number = ?", [receiptNum]);
    if (!sale) return { success: false, error: 'Receipt not found' };
    
    // Do not allow returning a return receipt
    if (sale.is_return) return { success: false, error: 'Cannot process a return on a Credit Note' };

    const items = queryAll("SELECT * FROM sale_items WHERE sale_id = ?", [sale.id]);
    sale.items = items;
    return { success: true, sale };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('billing:process-return', async (_e, { originalReceiptNumber, returnItems, userId }) => {
  try {
    const returnTransaction = db.transaction((receiptNum, itemsToReturn) => {
      const originalSale = db.prepare("SELECT * FROM sales WHERE receipt_number = ?").get(receiptNum);
      if (!originalSale) throw new Error("Receipt not found");
      if (originalSale.is_return) throw new Error("Cannot process a return on a Credit Note");

      if (!itemsToReturn || itemsToReturn.length === 0) {
        throw new Error("No items selected for return");
      }

      const isServiceSale = receiptNum.startsWith('SRV-');
      const creditNoteNumber = generateReceiptNumber(db, null, isServiceSale);

      let refundSubtotalPaise = 0;
      let refundCgstPaise = 0;
      let refundSgstPaise = 0;
      let refundIgstPaise = 0;
      let refundDiscountPaise = 0;

      const itemsDataToInsert = [];

      // 1. Process each item to return
      for (const reqItem of itemsToReturn) {
        const { saleItemId, qty } = reqItem;
        if (qty <= 0) continue;

        const originalItem = db.prepare("SELECT * FROM sale_items WHERE id = ? AND sale_id = ?").get(saleItemId, originalSale.id);
        if (!originalItem) throw new Error(`Item ID ${saleItemId} not found in this sale`);

        const returnedSoFar = originalItem.returned_quantity || 0;
        const availableToReturn = originalItem.quantity - returnedSoFar;

        if (qty > availableToReturn) {
          throw new Error(`Cannot return ${qty} of ${originalItem.product_name}. Only ${availableToReturn} available to return.`);
        }

        // Calculate proportional values for this item
        // Original unit price, GST percent
        const unitPrice = originalItem.unit_price_paise;
        const itemDiscount = Math.round((originalItem.discount_paise / originalItem.quantity) * qty);
        
        const lineTotal = Math.max(0, (unitPrice * qty) - itemDiscount);

        let taxableValue = lineTotal;
        let itemGst = 0;
        let cgst = 0, sgst = 0, igst = 0;

        if (originalItem.gst_percent > 0) {
          taxableValue = Math.round((lineTotal * 100) / (100 + originalItem.gst_percent));
          itemGst = lineTotal - taxableValue;

          if (originalSale.is_inter_state) {
            igst = itemGst;
          } else {
            cgst = Math.round(itemGst / 2);
            sgst = itemGst - cgst;
          }
        }

        refundSubtotalPaise += taxableValue;
        refundDiscountPaise += itemDiscount;
        refundCgstPaise += cgst;
        refundSgstPaise += sgst;
        refundIgstPaise += igst;

        // Calculate proportional free quantity to return
        let freeQtyToReturn = 0;
        if (originalItem.free_quantity > 0) {
          freeQtyToReturn = Math.floor((originalItem.free_quantity / originalItem.quantity) * qty);
        }

        itemsDataToInsert.push({
          originalItem,
          qtyToReturn: qty,
          freeQtyToReturn,
          itemDiscount,
          lineTotal
        });

        // Update returned_quantity on the original item
        db.prepare("UPDATE sale_items SET returned_quantity = returned_quantity + ? WHERE id = ?").run(qty, saleItemId);
      }

      if (itemsDataToInsert.length === 0) {
        throw new Error("No valid items to return");
      }

      const rawRefundGrandTotal = refundSubtotalPaise + refundCgstPaise + refundSgstPaise + refundIgstPaise;
      
      // Calculate loyalty point adjustments
      let rewardToReverse = 0;
      let couponToRefund = 0;
      let finalRefundGrandTotal = rawRefundGrandTotal;

      if (originalSale.customer_phone) {
        // Calculate the NEW total sale value after this return
        const remainingGrandTotal = originalSale.grand_total_paise - rawRefundGrandTotal;

        // User Logic: "if after their purchase value come under 1000 no loyalty but still they are above 1000 provide the loyalty according to that"
        const originalReward = originalSale.reward_earned_paise || 0;
        let newRewardShouldBe = 0;
        
        if (remainingGrandTotal >= 100000) { // 1000 rupees
          newRewardShouldBe = Math.floor(remainingGrandTotal * 0.01);
        }

        // We reverse the difference between what they got and what they should have
        rewardToReverse = Math.max(0, originalReward - newRewardShouldBe);

        // For coupons, refund proportionally
        const appliedCoupon = originalSale.applied_coupon_paise || 0;
        if (appliedCoupon > 0 && originalSale.grand_total_paise > 0) {
          const refundRatio = rawRefundGrandTotal / originalSale.grand_total_paise;
          couponToRefund = Math.round(appliedCoupon * refundRatio);
          finalRefundGrandTotal -= couponToRefund; // Coupon value was just a discount, not cash to refund
        }

        const cust = db.prepare("SELECT id, coupon_balance_paise FROM customers WHERE phone_number = ?").get(originalSale.customer_phone);
        if (cust) {
          db.prepare(
            "UPDATE customers SET coupon_balance_paise = MAX(0, coupon_balance_paise - ? + ?), total_lifetime_spent_paise = MAX(0, total_lifetime_spent_paise - ?), updated_at = datetime('now','localtime') WHERE id = ?"
          ).run(rewardToReverse, couponToRefund, rawRefundGrandTotal, cust.id);
        }
      }

      // Create negative sale record
      const { lastInsertRowid: returnSaleId } = db.prepare(
        `INSERT INTO sales (receipt_number, user_id, customer_name, customer_gstin, is_b2b, subtotal_paise, discount_paise,
          cgst_paise, sgst_paise, igst_paise, is_inter_state, grand_total_paise, payment_mode, is_return, original_receipt_number, notes, applied_coupon_paise, reward_earned_paise)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        creditNoteNumber, userId || null, originalSale.customer_name, originalSale.customer_gstin, originalSale.is_b2b,
        -refundSubtotalPaise, -refundDiscountPaise, -refundCgstPaise, -refundSgstPaise, -refundIgstPaise,
        originalSale.is_inter_state, -finalRefundGrandTotal, originalSale.payment_mode, 1, receiptNum, 'Sales Return', -couponToRefund, -rewardToReverse
      );

      // Restore inventory and insert negative sale items
      for (const data of itemsDataToInsert) {
        const { originalItem, qtyToReturn, freeQtyToReturn, itemDiscount, lineTotal } = data;
        const totalQuantityToRestore = qtyToReturn + freeQtyToReturn;

        db.prepare(
          `INSERT INTO sale_items (sale_id, product_id, product_name, barcode, quantity, free_quantity, unit_price_paise, purchase_price_paise, discount_paise, gst_percent, hsn_code, line_total_paise, batch_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          returnSaleId, originalItem.product_id, originalItem.product_name, originalItem.barcode, -qtyToReturn, -freeQtyToReturn,
          originalItem.unit_price_paise, originalItem.purchase_price_paise, -itemDiscount, originalItem.gst_percent, originalItem.hsn_code, -lineTotal, originalItem.batch_id
        );

        const product = db.prepare("SELECT c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?").get(originalItem.product_id);
        const isService = product && ((product.category_name || '').toLowerCase().includes('service') || (product.category_name || '').toLowerCase().includes('grooming') || (originalItem.barcode || '').startsWith('SRV-'));

        if (!isService && totalQuantityToRestore > 0) {
          db.prepare("UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?").run(totalQuantityToRestore, originalItem.product_id);

          db.prepare(
            "INSERT INTO inventory_adjustments (product_id, adjustment_type, quantity, reason, user_id) VALUES (?, 'add', ?, ?, ?)"
          ).run(originalItem.product_id, totalQuantityToRestore, `Return against ${receiptNum}`, userId || null);

          if (originalItem.batch_id) {
            db.prepare("UPDATE product_batches SET quantity = quantity + ? WHERE id = ?").run(totalQuantityToRestore, originalItem.batch_id);
          }
        }
      }

      // Check if the sale is fully returned to update `originalSale` notes or status if needed. We don't have a specific fully_returned flag, but that's fine.

      return { success: true, creditNoteNumber, grandTotalPaise: finalRefundGrandTotal, refundCash: rawRefundGrandTotal };
    });

    const result = returnTransaction(originalReceiptNumber, returnItems);
    return result;
  } catch (err) {
    console.error('[IPC] billing:process-return error:', err);
    return { success: false, error: err.message };
  }
});

// ─── PURCHASES ───────────────────────────────────────────────────────────────

ipcMain.handle('purchases:add', async (_e, { supplierId, supplierGstin, invoiceNumber, items, notes, gstPaidPaise, roundOffPaise, discountPaise, explicitTotalPaise, status, amountPaidPaise, dueDate, attachmentPath, draftId, purchaseDate }) => {
  try {
    const purchaseTransaction = db.transaction(() => {
      if (draftId) {
        // Bug fix: Reverse stock/batch effects if the old purchase was finalized
        const oldPurchase = db.prepare("SELECT * FROM purchases WHERE id = ?").get(draftId);
        if (oldPurchase && oldPurchase.status !== 'Draft') {
          const oldItems = db.prepare("SELECT * FROM purchase_items WHERE purchase_id = ?").all(draftId);
          const oldInvNum = oldPurchase.invoice_number || draftId;
          for (const oi of oldItems) {
            const totalQty = oi.quantity + (oi.free_quantity || 0);
            if (totalQty > 0) {
              const curProd = db.prepare("SELECT stock_quantity FROM products WHERE id = ?").get(oi.product_id);
              const deductQty = Math.min(totalQty, Math.max(0, curProd ? curProd.stock_quantity : 0));
              if (deductQty > 0) {
                db.prepare("UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?").run(deductQty, oi.product_id);
              }
              db.prepare("INSERT INTO inventory_adjustments (product_id, adjustment_type, quantity, reason) VALUES (?, 'reduce', ?, ?)").run(oi.product_id, totalQty, `Purchase Re-saved: ${oldInvNum}`);
            }
          }
          // Delete batches created for the old purchase
          for (const oi of oldItems) {
            const escapedOldInv = String(oldInvNum).replace(/[%_]/g, '\\$&');
            db.prepare("DELETE FROM product_batches WHERE product_id = ? AND batch_number LIKE ? ESCAPE '\\'").run(oi.product_id, `P-${escapedOldInv}-%`);
          }
        }
        db.prepare("DELETE FROM purchase_items WHERE purchase_id = ?").run(draftId);
        db.prepare("DELETE FROM purchases WHERE id = ?").run(draftId);
      }

      let totalPaise = 0;
      if (explicitTotalPaise !== undefined && explicitTotalPaise !== null) {
        totalPaise = explicitTotalPaise;
      } else {
        for (const item of items) {
          if (item.explicitLineTotalPaise !== undefined) {
            totalPaise += item.explicitLineTotalPaise;
          } else if (item.schemeDiscountPaise !== undefined && item.basePricePaise !== undefined) {
            totalPaise += Math.max(0, (item.quantity * item.basePricePaise) - item.schemeDiscountPaise);
          } else {
            totalPaise += item.purchasePricePaise * item.quantity;
          }
        }
        totalPaise += (gstPaidPaise || 0);
        totalPaise += (roundOffPaise || 0);
      }

      const pStatus = status || 'Paid';
      const pAmountPaid = amountPaidPaise || 0;
      const pDueDate = dueDate || '';
      const pAttachment = attachmentPath || '';

      const pPurchaseDate = purchaseDate || new Date().toISOString().split('T')[0];

      // Insert Purchase Header
      const { lastInsertRowid: purchaseId } = db.prepare(
        "INSERT INTO purchases (supplier_id, supplier_gstin, invoice_number, total_paise, gst_paid_paise, round_off_paise, discount_paise, notes, status, amount_paid_paise, due_date, attachment_path, purchase_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(supplierId, supplierGstin || '', invoiceNumber || '', totalPaise, gstPaidPaise || 0, roundOffPaise || 0, discountPaise || 0, notes || '', pStatus, pAmountPaid, pDueDate, pAttachment, pPurchaseDate);

      // Calculate total item base value for proration
      let totalItemsBasePaise = 0;
      for (const item of items) {
        if (item.explicitLineTotalPaise !== undefined) {
           totalItemsBasePaise += item.explicitLineTotalPaise;
        } else {
           totalItemsBasePaise += (item.purchasePricePaise || 0) * (item.quantity || 0);
        }
      }

      for (const item of items) {
        let productId;

        // Prorate invoice-level discount
        let effectivePurchasePricePaise = item.purchasePricePaise;
        if (discountPaise > 0 && totalItemsBasePaise > 0 && item.quantity > 0) {
           const itemLineTotal = item.explicitLineTotalPaise !== undefined ? item.explicitLineTotalPaise : ((item.purchasePricePaise || 0) * item.quantity);
           const discountShare = Math.round(discountPaise * (itemLineTotal / totalItemsBasePaise));
           const discountPerUnit = Math.round(discountShare / item.quantity);
           effectivePurchasePricePaise = Math.max(0, item.purchasePricePaise - discountPerUnit);
        }

        // Check if product exists by barcode
        const existing = db.prepare("SELECT id FROM products WHERE barcode = ?").get(item.barcode);

        if (existing) {
          productId = existing.id;
          if (pStatus !== 'Draft') {
            // Update existing product with latest prices and HSN (reactivating if deleted)
            const perUnitSchemeDisc = item.quantity > 0 ? Math.round((item.schemeDiscountPaise ?? 0) / item.quantity) : 0;
            db.prepare(
              "UPDATE products SET is_active = 1, base_price_paise = ?, scheme_discount_paise = ?, purchase_price_paise = ?, selling_price_paise = ?, hsn_code = ?, updated_at = datetime('now','localtime') WHERE id = ?"
            ).run(item.basePricePaise ?? 0, perUnitSchemeDisc, effectivePurchasePricePaise, item.sellingPricePaise, item.hsnCode, productId);
          }
        } else {
          // Create new product
          const perUnitSchemeDisc = item.quantity > 0 ? Math.round((item.schemeDiscountPaise ?? 0) / item.quantity) : 0;
          const res = db.prepare(
            `INSERT INTO products (barcode, product_name, category_id, supplier_id, base_price_paise, scheme_discount_paise, purchase_price_paise, selling_price_paise, gst_percent, hsn_code, stock_quantity)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)` // Stock will be incremented below if not draft
          ).run(
            item.barcode, item.productName, item.categoryId || null, supplierId,
            item.basePricePaise ?? 0, perUnitSchemeDisc,
            effectivePurchasePricePaise, item.sellingPricePaise, (item.cgstPercent + item.sgstPercent), item.hsnCode
          );
          productId = res.lastInsertRowid;
        }

        const freeQuantity = parseInt(item.freeQuantity) || 0;
        const totalQuantityToStock = item.quantity + freeQuantity;
        let lineTotal = 0;
        if (item.explicitLineTotalPaise !== undefined) {
          lineTotal = item.explicitLineTotalPaise;
        } else if (item.schemeDiscountPaise !== undefined && item.basePricePaise !== undefined) {
          lineTotal = Math.max(0, (item.quantity * item.basePricePaise) - item.schemeDiscountPaise);
        } else {
          lineTotal = item.purchasePricePaise * item.quantity;
        }

        // Insert Purchase Item
        db.prepare(
          "INSERT INTO purchase_items (purchase_id, product_id, quantity, free_quantity, base_cost_paise, scheme_discount_paise, unit_cost_paise, line_total_paise, cgst_percent, sgst_percent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).run(purchaseId, productId, item.quantity, freeQuantity, item.basePricePaise ?? 0, item.schemeDiscountPaise ?? 0, item.purchasePricePaise, lineTotal, item.cgstPercent, item.sgstPercent);

        if (pStatus !== 'Draft') {
          // Increase inventory
          db.prepare("UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?").run(
            totalQuantityToStock, productId
          );

          // Log adjustment
          db.prepare(
            "INSERT INTO inventory_adjustments (product_id, adjustment_type, quantity, reason) VALUES (?, 'purchase', ?, ?)"
          ).run(
            productId, totalQuantityToStock, `Purchase Invoice: ${invoiceNumber || purchaseId}`
          );

          // Create batch
          const batchNo = item.batchNumber || ('P-' + (invoiceNumber || purchaseId) + '-' + Date.now().toString().slice(-4));
          const expDate = item.expiryDate || '';
          db.prepare(
            "INSERT INTO product_batches (product_id, batch_number, expiry_date, quantity, purchase_price_paise, selling_price_paise) VALUES (?, ?, ?, ?, ?, ?)"
          ).run(
            productId,
            batchNo,
            expDate,
            totalQuantityToStock,
            effectivePurchasePricePaise ?? 0,
            item.sellingPricePaise
          );
        }
      }

      return purchaseId;
    });

    const pId = purchaseTransaction();
    return { success: true, purchaseId: pId };
  } catch (err) {
    console.error('[IPC] purchases:add error:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('purchases:delete', async (_e, purchaseId) => {
  try {
    const purchaseTransaction = db.transaction(() => {
      const purchase = db.prepare("SELECT * FROM purchases WHERE id = ?").get(purchaseId);
      if (!purchase) return;

      if (purchase.status !== 'Draft') {
        const items = db.prepare("SELECT * FROM purchase_items WHERE purchase_id = ?").all(purchaseId);
        const invNum = purchase.invoice_number || purchaseId;

        for (const item of items) {
          const totalQty = item.quantity + (item.free_quantity || 0);
          
          if (totalQty > 0) {
            // Bug fix #8: Prevent stock from going negative — cap deduction at current stock
            const currentProduct = db.prepare("SELECT stock_quantity FROM products WHERE id = ?").get(item.product_id);
            const currentStock = currentProduct ? currentProduct.stock_quantity : 0;
            const deductQty = Math.min(totalQty, Math.max(0, currentStock));

            if (deductQty > 0) {
              db.prepare("UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?").run(
                deductQty, item.product_id
              );
            }

            // Log adjustment
            db.prepare(
              "INSERT INTO inventory_adjustments (product_id, adjustment_type, quantity, reason) VALUES (?, 'reduce', ?, ?)"
            ).run(
              item.product_id, totalQty, `Purchase Deleted: ${invNum}`
            );
          }
        }

        // Delete batches created for this purchase by auto-generated pattern (P-invNum-*)
        // and by matching the exact batch number stored during purchase creation
        for (const item of items) {
          const escapedInvNum = String(invNum).replace(/[%_]/g, '\\$&');
          db.prepare("DELETE FROM product_batches WHERE product_id = ? AND batch_number LIKE ? ESCAPE '\\'").run(item.product_id, `P-${escapedInvNum}-%`);
        }
      }

      // Delete items and purchase
      db.prepare("DELETE FROM purchase_items WHERE purchase_id = ?").run(purchaseId);
      db.prepare("DELETE FROM purchases WHERE id = ?").run(purchaseId);
    });

    purchaseTransaction();
    return { success: true };
  } catch (err) {
    console.error('purchases:delete error:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('purchases:check-invoice', async (_e, { supplierId, invoiceNumber }) => {
  try {
    const existing = queryOne("SELECT id FROM purchases WHERE supplier_id = ? AND invoice_number = ? AND status != 'Draft'", [supplierId, invoiceNumber]);
    return { exists: !!existing };
  } catch (err) {
    return { exists: false, error: err.message };
  }
});

ipcMain.handle('purchases:return:add', async (_e, data) => {
  try {
    const returnTransaction = db.transaction(() => {
      const { lastInsertRowid: returnId } = db.prepare(
        "INSERT INTO purchase_returns (supplier_id, return_invoice_number, original_invoice_number, total_paise, total_gst_paise, notes) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(data.supplierId, data.returnInvoiceNumber || '', data.originalInvoiceNumber || '', data.totalPaise || 0, data.totalGstPaise || 0, data.notes || '');

      for (const item of data.items) {
        db.prepare(
          "INSERT INTO purchase_return_items (return_id, product_id, batch_number, quantity, refund_unit_paise, cgst_percent, sgst_percent, line_total_paise) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        ).run(returnId, item.productId, item.batchNumber || '', item.quantity, item.refundUnitPaise, item.cgstPercent || 0, item.sgstPercent || 0, item.lineTotalPaise);

        // Bug fix: Prevent stock from going negative on purchase return
        const currentProd = db.prepare("SELECT stock_quantity FROM products WHERE id = ?").get(item.productId);
        const currentStock = currentProd ? currentProd.stock_quantity : 0;
        const stockDeduct = Math.min(item.quantity, Math.max(0, currentStock));
        if (stockDeduct > 0) {
          db.prepare("UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?").run(stockDeduct, item.productId);
        }
        
        if (item.batchNumber) {
          // Bug fix: Prevent batch quantity from going negative
          db.prepare("UPDATE product_batches SET quantity = MAX(0, quantity - ?) WHERE product_id = ? AND batch_number = ?").run(item.quantity, item.productId, item.batchNumber);
        }

        db.prepare(
          "INSERT INTO inventory_adjustments (product_id, adjustment_type, quantity, reason) VALUES (?, 'reduce', ?, ?)"
        ).run(item.productId, item.quantity, `Purchase Return: ${data.returnInvoiceNumber}`);
      }
      return returnId;
    });

    const returnId = returnTransaction();
    return { success: true, returnId };
  } catch (err) {
    console.error('purchases:return:add error:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('purchases:return:get-all', async (_e, supplierId = null) => {
  try {
    const returns = queryAll(
      `SELECT pr.*, s.name as supplier_name,
        (SELECT COUNT(*) FROM purchase_return_items WHERE return_id = pr.id) as item_count
       FROM purchase_returns pr
       JOIN suppliers s ON pr.supplier_id = s.id
       WHERE (? IS NULL OR pr.supplier_id = ?)
       ORDER BY pr.created_at DESC`,
       [supplierId, supplierId]
    );
    return returns;
  } catch (err) {
    return [];
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

ipcMain.handle('purchases:get-details', async (_e, purchaseId) => {
  try {
    const items = queryAll(`
      SELECT pi.*, p.product_name, p.barcode, p.hsn_code, p.selling_price_paise, c.name as category_name
      FROM purchase_items pi
      JOIN products p ON pi.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE pi.purchase_id = ?
    `, [purchaseId]);

    // Attempt to fetch batches corresponding to this purchase invoice, just to show batch numbers
    const purchase = queryOne("SELECT * FROM purchases WHERE id = ?", [purchaseId]);
    const invNum = purchase?.invoice_number || purchaseId;

    for (const item of items) {
      // Find batch starting with P-invNum
      const batch = queryOne(
        "SELECT batch_number FROM product_batches WHERE product_id = ? AND batch_number LIKE ? LIMIT 1",
        [item.product_id, `P-${invNum}-%`]
      );
      item.batch_number = batch ? batch.batch_number : null;
    }

    return { success: true, items, purchase };
  } catch (err) {
    console.error('purchases:get-details error:', err);
    return { success: false, error: err.message };
  }
});

// ─── DASHBOARD ───────────────────────────────────────────────────────────────

// Bug fix #1: Add missing IPC handlers exposed in preload.js
ipcMain.handle('app:get-db-path', async () => {
  return dbPath;
});

ipcMain.handle('app:check-db-location', async () => {
  try {
    const exists = fs.existsSync(dbPath);
    const stats = exists ? fs.statSync(dbPath) : null;
    return {
      path: dbPath,
      exists,
      sizeBytes: stats ? stats.size : 0,
      isDev
    };
  } catch (err) {
    return { path: dbPath, exists: false, sizeBytes: 0, isDev, error: err.message };
  }
});

ipcMain.handle('app:open-external', async (_e, filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      await shell.openPath(filePath);
      return { success: true };
    }
    return { success: false, error: 'File not found on disk' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('dashboard:get-stats', async () => {
  try {
    // Bug fix #14: Use local date instead of UTC to match datetime('now','localtime') in DB
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;

    const todaySales = queryOne(
      "SELECT COALESCE(SUM(grand_total_paise), 0) as total, SUM(CASE WHEN COALESCE(is_return, 0) = 0 THEN 1 ELSE 0 END) as cnt FROM sales WHERE created_at LIKE ?",
      [`${todayStr}%`]
    );

    const monthlySales = queryOne(
      "SELECT COALESCE(SUM(grand_total_paise), 0) as total, SUM(CASE WHEN COALESCE(is_return, 0) = 0 THEN 1 ELSE 0 END) as cnt FROM sales WHERE created_at >= ?",
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

    // Bug fix #11: Include negative stock products in out-of-stock count
    const outOfStock = queryOne(
      "SELECT COUNT(*) as cnt FROM products WHERE is_active = 1 AND stock_quantity <= 0"
    );

    const recentSales = queryAll(
      "SELECT * FROM sales ORDER BY created_at DESC LIMIT 10"
    );

    // Expiry alerts
    const expiring30 = queryAll(
      `SELECT pb.*, p.product_name FROM product_batches pb
       JOIN products p ON pb.product_id = p.id
       WHERE pb.expiry_date != '' AND pb.expiry_date <= date('now', '+30 days') AND pb.expiry_date > date('now') AND p.is_active = 1
       ORDER BY pb.expiry_date LIMIT 10`
    );

    const expired = queryAll(
      `SELECT pb.*, p.product_name FROM product_batches pb
       JOIN products p ON pb.product_id = p.id
       WHERE pb.expiry_date != '' AND pb.expiry_date <= date('now') AND p.is_active = 1
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
        COALESCE(SUM(igst_paise), 0) as total_igst,
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

ipcMain.handle('reports:services', async (_e, { startDate, endDate }) => {
  try {
    let salesQuery = `SELECT s.*, u.display_name as cashier_name,
        (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) as item_count
       FROM sales s
       LEFT JOIN users u ON s.user_id = u.id
       WHERE date(s.created_at) >= ? AND date(s.created_at) <= ?
       AND (s.receipt_number LIKE 'SRV-%' OR EXISTS (
         SELECT 1 FROM sale_items si 
         LEFT JOIN products p ON si.product_id = p.id 
         LEFT JOIN categories c ON p.category_id = c.id 
         WHERE si.sale_id = s.id 
         AND (LOWER(COALESCE(c.name, '')) LIKE '%service%' OR LOWER(COALESCE(c.name, '')) LIKE '%grooming%' OR si.barcode LIKE 'SRV-%')
       ))`;

    let summaryQuery = `SELECT COUNT(*) as total_sales,
        COALESCE(SUM(subtotal_paise), 0) as total_subtotal,
        COALESCE(SUM(discount_paise), 0) as total_discount,
        COALESCE(SUM(cgst_paise), 0) as total_cgst,
        COALESCE(SUM(sgst_paise), 0) as total_sgst,
        COALESCE(SUM(igst_paise), 0) as total_igst,
        COALESCE(SUM(grand_total_paise), 0) as total_grand
       FROM sales s WHERE date(s.created_at) >= ? AND date(s.created_at) <= ?
       AND (s.receipt_number LIKE 'SRV-%' OR EXISTS (
         SELECT 1 FROM sale_items si 
         LEFT JOIN products p ON si.product_id = p.id 
         LEFT JOIN categories c ON p.category_id = c.id 
         WHERE si.sale_id = s.id 
         AND (LOWER(COALESCE(c.name, '')) LIKE '%service%' OR LOWER(COALESCE(c.name, '')) LIKE '%grooming%' OR si.barcode LIKE 'SRV-%')
       ))`;

    const params = [startDate, endDate];
    salesQuery += ` ORDER BY s.created_at DESC`;

    const sales = queryAll(salesQuery, params);
    const summary = queryOne(summaryQuery, params);

    return { sales, summary };
  } catch (err) {
    return { sales: [], summary: null };
  }
});

ipcMain.handle('reports:hsn-summary', async (_e, { startDate, endDate }) => {
  try {
    const rawItems = queryAll(`
      SELECT 
        si.hsn_code,
        p.product_name as description,
        si.quantity,
        si.unit_price_paise,
        si.line_total_paise,
        si.gst_percent,
        s.is_inter_state
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      LEFT JOIN products p ON si.product_id = p.id
      WHERE date(s.created_at) >= ? AND date(s.created_at) <= ?
    `, [startDate, endDate]);

    const map = {};
    for (const item of rawItems) {
      const hsn = item.hsn_code || 'Unassigned';
      const key = hsn;
      if (!map[key]) {
        map[key] = {
          hsn_code: hsn,
          description: item.description || 'N/A',
          total_quantity: 0,
          total_taxable_value: 0,
          total_cgst: 0,
          total_sgst: 0,
          total_igst: 0,
          total_gst: 0
        };
      }

      // Bug fix: Reverse-calculate taxable value from GST-inclusive line_total_paise
      const lineTotal = item.line_total_paise;
      const taxableValue = item.gst_percent > 0 ? Math.round((lineTotal * 100) / (100 + item.gst_percent)) : lineTotal;
      const gstAmount = lineTotal - taxableValue;
      let cgst = 0, sgst = 0, igst = 0;
      if (item.is_inter_state) {
        igst = gstAmount;
      } else {
        cgst = Math.round(gstAmount / 2);
        sgst = Math.round(gstAmount / 2);
      }

      map[key].total_quantity += item.quantity;
      map[key].total_taxable_value += taxableValue;
      map[key].total_cgst += cgst;
      map[key].total_sgst += sgst;
      map[key].total_igst += igst;
      map[key].total_gst += (cgst + sgst + igst);
    }

    return Object.values(map);
  } catch (err) {
    console.error('HSN Summary error:', err);
    return [];
  }
});

ipcMain.handle('reports:reconciliation', async (_e, { startDate, endDate }) => {
  try {
    const summary = queryAll(`
      SELECT 
        payment_mode,
        SUM(CASE WHEN COALESCE(is_return, 0) = 0 THEN 1 ELSE 0 END) as transaction_count,
        SUM(grand_total_paise) as total_amount
      FROM sales
      WHERE substr(created_at, 1, 10) >= ? AND substr(created_at, 1, 10) <= ?
      GROUP BY payment_mode
    `, [startDate, endDate]);

    const sales = queryAll(`
      SELECT 
        id, receipt_number, customer_name, customer_phone, is_b2b, customer_gstin, payment_mode, grand_total_paise, created_at, COALESCE(is_return, 0) as is_return
      FROM sales
      WHERE substr(created_at, 1, 10) >= ? AND substr(created_at, 1, 10) <= ?
      ORDER BY created_at DESC
    `, [startDate, endDate]);

    return { summary, sales };
  } catch (err) {
    return { summary: [], sales: [] };
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
      sql += " AND p.stock_quantity <= 0";
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

    const discountRes = queryAll(
      `SELECT SUM(discount_paise) as total_discount
       FROM sales
       WHERE date(created_at) >= ? AND date(created_at) <= ?`,
      [startDate, endDate]
    );
    const totalDiscount = discountRes[0]?.total_discount || 0;

    totalRevenue -= totalDiscount;

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

// ─── GSTR-1 COMPLIANCE ────────────────────────────────────────────────────────
ipcMain.handle('reports:gstr1', async (_e, { startDate, endDate }) => {
  try {
    const params = [startDate, endDate];

    // Table 4A, 4B, 4C, 6B, 6C (B2B)
    const b2b = queryAll(`
      SELECT s.receipt_number, s.created_at, COALESCE(s.customer_gstin,'') as customer_gstin,
             COALESCE(s.customer_name,'') as customer_name,
             s.subtotal_paise, s.cgst_paise, s.sgst_paise, s.igst_paise, s.grand_total_paise,
             s.is_inter_state, COALESCE(s.customer_state_code,'') as customer_state_code
      FROM sales s
      WHERE date(s.created_at) >= ? AND date(s.created_at) <= ?
        AND s.is_b2b = 1 AND s.is_return = 0
    `, params);

    // B2C Large (Table 5) - Inter-state, B2C, Value > 2.5 Lakhs
    const b2cLarge = queryAll(`
      SELECT s.receipt_number, s.created_at,
             s.subtotal_paise, s.igst_paise, s.grand_total_paise, s.customer_state_code
      FROM sales s
      WHERE date(s.created_at) >= ? AND date(s.created_at) <= ?
        AND (s.is_b2b = 0 OR s.customer_gstin = '') AND s.is_return = 0 AND s.is_inter_state = 1
        AND s.grand_total_paise > 25000000
    `, params);

    // B2C Small (Table 7) - B2C, not in Table 5
    const b2cSmallItems = queryAll(`
      SELECT s.is_inter_state, si.gst_percent, si.line_total_paise, s.customer_state_code
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE date(s.created_at) >= ? AND date(s.created_at) <= ?
        AND (s.is_b2b = 0 OR s.customer_gstin = '') AND s.is_return = 0
        AND NOT (s.is_inter_state = 1 AND s.grand_total_paise > 25000000)
    `, params);

    const b2cSmallMap = {};
    for (const item of b2cSmallItems) {
      const pos = item.customer_state_code || (item.is_inter_state ? 'OT' : 'local');
      const key = `${pos}_${item.gst_percent}`;
      if (!b2cSmallMap[key]) {
        b2cSmallMap[key] = { is_inter_state: item.is_inter_state, gst_percent: item.gst_percent, place_of_supply: pos, taxable_value: 0, cgst: 0, sgst: 0, igst: 0 };
      }
      b2cSmallMap[key].taxable_value += item.line_total_paise;
      const gstAmount = Math.round(item.line_total_paise * item.gst_percent / 100);
      if (item.is_inter_state) {
        b2cSmallMap[key].igst += gstAmount;
      } else {
        const halfGst = Math.round(gstAmount / 2);
        b2cSmallMap[key].cgst += halfGst;
        b2cSmallMap[key].sgst += halfGst;
      }
    }
    const b2cSmall = Object.values(b2cSmallMap);

    // Table 9B (Credit Notes)
    const creditNotes = queryAll(`
      SELECT s.receipt_number, s.created_at, s.original_receipt_number,
             s.is_b2b, s.customer_gstin, s.customer_name,
             s.subtotal_paise, s.cgst_paise, s.sgst_paise, s.igst_paise, s.grand_total_paise, s.is_inter_state
      FROM sales s
      WHERE date(s.created_at) >= ? AND date(s.created_at) <= ?
        AND s.is_return = 1
    `, params);

    // Table 13 (Documents Issued)
    // Needs to fetch minimum and maximum receipt numbers
    const docs = queryOne(`
      SELECT 
        MIN(receipt_number) as start_num,
        MAX(receipt_number) as end_num,
        COUNT(receipt_number) as total_count,
        0 as cancelled_count
      FROM sales
      WHERE date(created_at) >= ? AND date(created_at) <= ? AND is_return = 0
    `, params);

    const docsReturn = queryOne(`
      SELECT 
        MIN(receipt_number) as start_num,
        MAX(receipt_number) as end_num,
        COUNT(receipt_number) as total_count,
        0 as cancelled_count
      FROM sales
      WHERE date(created_at) >= ? AND date(created_at) <= ? AND is_return = 1
    `, params);

    docs.net_count = (docs.total_count || 0) - (docs.cancelled_count || 0);
    if (docsReturn) docsReturn.net_count = (docsReturn.total_count || 0) - (docsReturn.cancelled_count || 0);

    return { b2b, b2cLarge, b2cSmall, creditNotes, docs, docsReturn };
  } catch (err) {
    // Bug fix #4: Return error object instead of re-throwing (consistent with all other handlers)
    console.error('GSTR1 error:', err);
    return { error: err.message, b2b: [], b2cLarge: [], b2cSmall: [], creditNotes: [], docs: null, docsReturn: null };
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
  // Bug fix #2: Use absolute temp path instead of relative CWD
  const backupTempPath = path.join(app.getPath('temp'), 'pos_backup_' + Date.now() + '.db');
  try {
    // Checkpoint WAL to ensure backup is consistent
    try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch(e) { /* non-fatal */ }

    await db.backup(backupTempPath);
    // Read the backup file
    const data = fs.readFileSync(backupTempPath);
    const base64 = data.toString('base64');

    // Clean up temporary backup file
    try { fs.unlinkSync(backupTempPath); } catch(e) { /* best effort cleanup */ }

    // Update last backup time
    runSql("INSERT OR REPLACE INTO settings (key, value) VALUES ('last_backup', ?)",
      [new Date().toISOString()]);

    return { success: true, data: base64, size: data.length };
  } catch (err) {
    // Clean up temp file on failure too
    try { fs.unlinkSync(backupTempPath); } catch(e) { /* ignore */ }
    return { success: false, error: err.message };
  }
});

ipcMain.handle('backup:import', async (_e, base64Data) => {
  // Create a safety backup before overwriting, so we can recover if import fails
  const safetyBackupPath = dbPath + '.pre_import_backup';
  try {
    const buffer = Buffer.from(base64Data, 'base64');

    // Step 1: Validate the imported data is a valid SQLite file (magic header check)
    // SQLite files start with "SQLite format 3\000"
    const sqliteHeader = Buffer.from('SQLite format 3\0');
    if (buffer.length < 16 || !buffer.subarray(0, 16).equals(sqliteHeader)) {
      return { success: false, error: 'The selected file is not a valid database file.' };
    }

    // Step 2: Create a safety backup of the current working database
    try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch(e) { /* non-fatal */ }
    db.close();
    fs.copyFileSync(dbPath, safetyBackupPath);

    // Step 3: Write the imported data
    fs.writeFileSync(dbPath, buffer);

    // Step 4: Try to open and validate
    db = new Database(dbPath);
    initializeSchema(db);
    db.prepare("SELECT COUNT(*) FROM products").get();

    // Success — clean up safety backup
    try { fs.unlinkSync(safetyBackupPath); } catch(e) { /* best effort */ }

    return { success: true };
  } catch (err) {
    // Import failed — restore from safety backup
    try {
      if (db && db.open) { try { db.close(); } catch(e) { /* ignore */ } }
      if (fs.existsSync(safetyBackupPath)) {
        fs.copyFileSync(safetyBackupPath, dbPath);
        try { fs.unlinkSync(safetyBackupPath); } catch(e) { /* ignore */ }
      }
      db = new Database(dbPath);
      initializeSchema(db);
    } catch (e) {
      console.error('[DB] CRITICAL: Failed to restore from safety backup:', e);
    }
    return { success: false, error: 'Invalid database file: ' + err.message };
  }
});