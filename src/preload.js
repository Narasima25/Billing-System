// ═══════════════════════════════════════════════════════════════════════════
//  preload.js — Secure IPC Bridge (contextBridge)
//  Exposes all API channels grouped by module namespace.
//  contextIsolation: true, nodeIntegration: false
// ═══════════════════════════════════════════════════════════════════════════

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {

  // ─── App ─────────────────────────────────────────────────────────────
  app: {
    getDbPath: () => ipcRenderer.invoke('app:get-db-path'),
    checkDbLocation: () => ipcRenderer.invoke('app:check-db-location'),
    openExternal: (filePath) => ipcRenderer.invoke('app:open-external', filePath)
  },

  // ─── Auth ────────────────────────────────────────────────────────────
  auth: {
    login: (credentials) => ipcRenderer.invoke('auth:login', credentials),
    getUsers: () => ipcRenderer.invoke('auth:get-users'),
    createUser: (data) => ipcRenderer.invoke('auth:create-user', data),
    updateUser: (data) => ipcRenderer.invoke('auth:update-user', data),
    deleteUser: (id) => ipcRenderer.invoke('auth:delete-user', id),
  },

  // ─── Categories ──────────────────────────────────────────────────────
  categories: {
    getAll: () => ipcRenderer.invoke('categories:get-all'),
    add: (data) => ipcRenderer.invoke('categories:add', data),
    update: (data) => ipcRenderer.invoke('categories:update', data),
    delete: (id) => ipcRenderer.invoke('categories:delete', id),
  },

  // ─── Suppliers ─────────────────────────────────────────────────────
  suppliers: {
    getAll: (options) => ipcRenderer.invoke('suppliers:get-all', options),
    add: (data) => ipcRenderer.invoke('suppliers:add', data),
    update: (data) => ipcRenderer.invoke('suppliers:update', data),
    delete: (id) => ipcRenderer.invoke('suppliers:delete', id),
    hardDelete: (id) => ipcRenderer.invoke('suppliers:hard-delete', id),
    restore: (id) => ipcRenderer.invoke('suppliers:restore', id),
    getPurchases: (id) => ipcRenderer.invoke('suppliers:get-purchases', id),
    getLedger: (month) => ipcRenderer.invoke('suppliers:get-ledger', month),
  },

  // ─── Products ────────────────────────────────────────────────────────
  products: {
    getAll: (params) => ipcRenderer.invoke('products:get-all', params),
    lookupBarcode: (barcode) => ipcRenderer.invoke('products:lookup-barcode', barcode),
    add: (data) => ipcRenderer.invoke('products:add', data),
    update: (data) => ipcRenderer.invoke('products:update', data),
    delete: (id) => ipcRenderer.invoke('products:delete', id),
    getBatches: (productId) => ipcRenderer.invoke('products:get-batches', productId),
  },


  // ─── Inventory ───────────────────────────────────────────────────────
  inventory: {
    stockIn: (data) => ipcRenderer.invoke('inventory:stock-in', data),
    adjust: (data) => ipcRenderer.invoke('inventory:adjust', data),
    getAdjustments: (params) => ipcRenderer.invoke('inventory:get-adjustments', params),
    auditData: () => ipcRenderer.invoke('inventory:audit-data'),
  },

  // ─── Batches ─────────────────────────────────────────────────────────
  batches: {
    add: (data) => ipcRenderer.invoke('batches:add', data),
    getByProduct: (productId) => ipcRenderer.invoke('batches:get-by-product', productId),
    getExpiring: (days) => ipcRenderer.invoke('batches:get-expiring', days),
    getAll: () => ipcRenderer.invoke('batches:get-all')
  },

  // ─── Billing ─────────────────────────────────────────────────────────
  billing: {
    checkout: (data) => ipcRenderer.invoke('billing:checkout', data),
    getSale: (id) => ipcRenderer.invoke('billing:get-sale', id),
    getRecentSales: (limit) => ipcRenderer.invoke('billing:get-recent-sales', limit),
    getLastSale: () => ipcRenderer.invoke('billing:get-last-sale'),
    processReturn: (data) => ipcRenderer.invoke('billing:process-return', data),
    getCustomer: (phone) => ipcRenderer.invoke('billing:get-customer', phone),
  },

  // ─── Customers ───────────────────────────────────────────────────────
  customers: {
    getAll: () => ipcRenderer.invoke('customers:get-all'),
    getHistory: (phone) => ipcRenderer.invoke('customers:get-history', phone),
    sendUpdate: (data) => ipcRenderer.invoke('customers:send-update', data),
    sendBulkUpdate: (data) => ipcRenderer.invoke('customers:send-bulk-update', data),
  },

  purchases: {
    add: (data) => ipcRenderer.invoke('purchases:add', data),
    checkInvoice: (data) => ipcRenderer.invoke('purchases:check-invoice', data),
    getAll: (params) => ipcRenderer.invoke('purchases:get-all', params),
    getDetails: (id) => ipcRenderer.invoke('purchases:get-details', id),
    delete: (id) => ipcRenderer.invoke('purchases:delete', id),
    addReturn: (data) => ipcRenderer.invoke('purchases:return:add', data),
    getReturns: (supplierId) => ipcRenderer.invoke('purchases:return:get-all', supplierId),
  },

  // ─── Dashboard ───────────────────────────────────────────────────────
  dashboard: {
    getStats: () => ipcRenderer.invoke('dashboard:get-stats'),
  },

  // ─── Reports ─────────────────────────────────────────────────────────
  reports: {
    sales: (params) => ipcRenderer.invoke('reports:sales', params),
    inventory: (params) => ipcRenderer.invoke('reports:inventory', params),
    purchases: (params) => ipcRenderer.invoke('reports:purchases', params),
    profit: (params) => ipcRenderer.invoke('reports:profit', params),
    hsnSummary: (params) => ipcRenderer.invoke('reports:hsn-summary', params),
    reconciliation: (params) => ipcRenderer.invoke('reports:reconciliation', params),
    gstr1: (params) => ipcRenderer.invoke('reports:gstr1', params),
  },

  // ─── Settings ────────────────────────────────────────────────────────
  settings: {
    get: (key) => ipcRenderer.invoke('settings:get', key),
    getAll: () => ipcRenderer.invoke('settings:get-all'),
    set: (data) => ipcRenderer.invoke('settings:set', data),
  },

  // ─── Backup ──────────────────────────────────────────────────────────
  backup: {
    export: () => ipcRenderer.invoke('backup:export'),
    import: (data) => ipcRenderer.invoke('backup:import', data),
  },

  // ─── Dialog / File Picker ───────────────────────────────────────────
  dialog: {
    openFile: (options) => ipcRenderer.invoke('dialog:open-file', options),
  },

  // ─── Updater ───────────────────────────────────────────────────────────
  updater: {
    check: () => ipcRenderer.invoke('updater:check'),
    onAvailable: (callback) => ipcRenderer.on('updater:available', callback),
    onNotAvailable: (callback) => ipcRenderer.on('updater:not-available', callback),
    onProgress: (callback) => ipcRenderer.on('updater:progress', callback),
    onError: (callback) => ipcRenderer.on('updater:error', callback),
  }
});
