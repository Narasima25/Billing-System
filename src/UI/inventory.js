// ═══════════════════════════════════════════════════════════════════════════
//  UI/inventory.js — Inventory Management Module
//  Stock In (barcode scan), Stock Adjustment, Inventory Audit, Batch tracking.
// ═══════════════════════════════════════════════════════════════════════════

const InventoryModule = (() => {
  const panel = document.getElementById('panel-inventory');
  let initialized = false;
  let activeTab = 'stockin';

  function init() {
    if (!initialized) {
      render();
      bindEvents();
      initialized = true;
    }
    switchTab(activeTab);
  }

  function render() {
    panel.innerHTML = `
      <div class="section-header">
        <h2>📦 Inventory Management</h2>
        <p>Stock In, Adjustments, Audit, and Batch Tracking</p>
      </div>

      <div class="tab-bar">
        <button class="tab-btn active" data-tab="stockin">📥 Stock In</button>
        <button class="tab-btn" data-tab="adjustments">📊 Adjustments</button>
        <button class="tab-btn" data-tab="audit">🔍 Audit</button>
        <button class="tab-btn" data-tab="batches">📋 Batches</button>
      </div>

      <!-- Stock In -->
      <div class="tab-pane active" id="inv-tab-stockin">
        <div class="grid-2">
          <div class="card">
            <div class="card-header">
              <div class="card-icon teal">📥</div>
              <div><h3>Scan Barcode</h3><p>Scan product barcode and enter quantity</p></div>
            </div>
            <div class="scanner-input-wrap mb-12">
              <span class="scan-icon">⎸</span>
              <input type="text" class="scanner-input" id="inv-scanner" placeholder="Scan barcode..." autocomplete="off">
            </div>
            
            <div class="customer-search-wrap" style="margin: 0 0 12px 0;">
              <input type="text" id="inv-manual-search" placeholder="Or search product by name..." autocomplete="off" style="padding: 10px 14px; font-size: 13px; border: 1px solid var(--border); border-radius: var(--radius-sm); width: 100%; background: var(--bg-input); color: var(--text-primary); outline: none;">
              <div class="customer-results" id="inv-manual-results" style="max-height: 250px; overflow-y: auto;"></div>
            </div>
            <div class="scanner-status"><span class="scanner-dot"></span> Ready for stock intake</div>
            <div id="inv-scan-result" class="mt-12"></div>
            <div id="inv-stockin-form" class="hidden mt-16">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Product</label>
                  <input type="text" class="form-input" id="inv-product-name" readonly>
                </div>
                <div class="form-group">
                  <label class="form-label">Current Stock</label>
                  <input type="text" class="form-input" id="inv-current-stock" readonly>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Quantity to Add *</label>
                <input type="number" class="form-input" id="inv-add-qty" min="1" placeholder="Enter quantity">
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Batch No. (Optional)</label>
                  <input type="text" class="form-input" id="inv-batch-no" placeholder="e.g. B123">
                </div>
                <div class="form-group">
                  <label class="form-label">Expiry Date (Optional)</label>
                  <input type="date" class="form-input" id="inv-expiry-date">
                </div>
              </div>
              <button class="btn btn-primary mt-12" id="inv-save-stockin">Save Stock In</button>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-icon green">📋</div>
              <div><h3>Session Log</h3><p>Items received this session</p></div>
            </div>
            <div id="inv-session-log">
              <div class="empty-state"><span class="empty-icon">📭</span><p>No items scanned yet</p></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Adjustments History -->
      <div class="tab-pane" id="inv-tab-adjustments">
        <div class="card" style="padding:0;">
          <div class="data-table-wrap" style="max-height:calc(100vh - 260px);">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Type</th>
                  <th>Qty</th>
                  <th>Reason</th>
                  <th>By</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody id="inv-adjust-tbody">
                <tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-muted);">Loading...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Audit -->
      <div class="tab-pane" id="inv-tab-audit">
        <div class="page-toolbar">
          <p class="text-muted text-sm">Compare system stock with physical count</p>
          <button class="btn btn-secondary" id="btn-export-audit">📥 Export CSV</button>
        </div>
        <div class="card" style="padding:0;">
          <div class="data-table-wrap" style="max-height:calc(100vh - 280px);">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Barcode</th>
                  <th>Product</th>
                  <th>System Qty</th>
                  <th>Physical Qty</th>
                  <th>Variance</th>
                </tr>
              </thead>
              <tbody id="inv-audit-tbody">
                <tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-muted);">Loading...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Batches -->
      <div class="tab-pane" id="inv-tab-batches">
        <div class="page-toolbar">
          <p class="text-muted text-sm">Track product batches with expiry dates</p>
          <button class="btn btn-secondary" id="btn-view-expiring">⚠️ View Expiring</button>
        </div>
        <div id="batches-content">
          <div class="empty-state"><span class="empty-icon">📋</span><p>Loading batches...</p></div>
        </div>
      </div>
    `;
  }

  function bindEvents() {
    // Tab switching
    panel.addEventListener('click', (e) => {
      const tabBtn = e.target.closest('.tab-btn');
      if (tabBtn) {
        activeTab = tabBtn.dataset.tab;
        switchTab(activeTab);
      }
    });

    // Global Scanner Buffer (Optimized for Mobile/3rd Party Scanner Apps)
    let scanBuffer = '';
    let scanTimer = null;

    document.addEventListener('keydown', async (e) => {
      if (!panel.classList.contains('active') || activeTab !== 'stockin' || document.querySelector('.modal-overlay.visible')) return;

      const scanner = document.getElementById('inv-scanner');
      
      // If user is actively typing in another input (like quantity or manual search), don't intercept
      if (document.activeElement && document.activeElement.tagName === 'INPUT' && document.activeElement !== scanner) {
        scanBuffer = '';
        return;
      }

      if (e.key === 'Enter') {
        let barcode = scanBuffer;
        scanBuffer = '';

        const scanner = document.getElementById('inv-scanner');
        // Fallback: If buffer dropped characters but input is focused, grab from input
        if ((!barcode || barcode.length < 3) && scanner && document.activeElement === scanner) {
          barcode = scanner.value.trim();
        }

        if (barcode && barcode.length >= 3) {
          e.preventDefault();
          if (scanner) scanner.value = '';
          await handleStockInScan(barcode);
        }
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        scanBuffer += e.key;
        clearTimeout(scanTimer);
        // Increased tolerance to 300ms for mobile scanner apps that type slower
        scanTimer = setTimeout(() => { scanBuffer = ''; }, 300);
      }
    });

    // Save stock in
    document.getElementById('inv-save-stockin').addEventListener('click', saveStockIn);
    document.getElementById('inv-add-qty').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') saveStockIn();
    });

    // Audit export
    document.getElementById('btn-export-audit').addEventListener('click', exportAuditCSV);

    // Batches
    document.getElementById('btn-view-expiring').addEventListener('click', () => loadBatches(true));

    // Manual Product Search (By Name) for Stock In
    const invManualSearch = document.getElementById('inv-manual-search');
    let invManualTimer = null;
    if (invManualSearch) {
      invManualSearch.addEventListener('input', () => {
        clearTimeout(invManualTimer);
        invManualTimer = setTimeout(async () => {
          const q = invManualSearch.value.trim();
          const resultsDiv = document.getElementById('inv-manual-results');
          if (q.length < 2) {
            resultsDiv.classList.remove('show');
            return;
          }
          const data = await window.api.products.getAll({ search: q, perPage: 15 });
          const products = data.products.filter(p => p.is_active === 1);
          
          if (products.length === 0) {
            resultsDiv.innerHTML = `<div class="customer-result-item text-muted">No products found</div>`;
          } else {
            resultsDiv.innerHTML = products.map(p => {
              return `<div class="customer-result-item" data-barcode="${p.barcode}" style="display:flex; justify-content:space-between; align-items:center;">
                 <div>
                   <strong>${p.product_name}</strong> <span class="text-xs text-muted" style="margin-left:4px;">${p.barcode}</span>
                   <div class="text-sm text-muted" style="margin-top:2px;">Stock: ${p.stock_quantity}</div>
                 </div>
               </div>`;
            }).join('');
          }
          resultsDiv.classList.add('show');
        }, 300);
      });

      document.getElementById('inv-manual-results').addEventListener('click', async (e) => {
        const item = e.target.closest('.customer-result-item');
        if (!item || !item.dataset.barcode) return;
        
        document.getElementById('inv-manual-results').classList.remove('show');
        invManualSearch.value = '';
        
        await handleStockInScan(item.dataset.barcode);
      });

      // Close manual results on click outside
      document.addEventListener('click', (e) => {
        if (!e.target.closest('#inv-manual-search') && !e.target.closest('#inv-manual-results')) {
          const mr = document.getElementById('inv-manual-results');
          if (mr) mr.classList.remove('show');
        }
      });
    }

    // Focus scanner periodically if not typing elsewhere
    setInterval(() => {
      if (panel.classList.contains('active') && activeTab === 'stockin') {
        const scanner = document.getElementById('inv-scanner');
        if (scanner && 
            document.activeElement.tagName !== 'INPUT' &&
            document.activeElement.tagName !== 'SELECT' &&
            document.activeElement.tagName !== 'TEXTAREA') {
          scanner.focus();
        }
      }
    }, 3000);
  }

  function switchTab(tab) {
    panel.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    panel.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    const pane = document.getElementById('inv-tab-' + tab);
    if (pane) pane.classList.add('active');

    if (tab === 'adjustments') loadAdjustments();
    if (tab === 'audit') loadAuditData();
    if (tab === 'batches') loadBatches(false);
    if (tab === 'stockin') {
      setTimeout(() => document.getElementById('inv-scanner')?.focus(), 100);
    }
  }

  let scannedProduct = null;
  let sessionLog = [];

  async function handleStockInScan(barcode) {
    const resultDiv = document.getElementById('inv-scan-result');
    try {
      const product = await window.api.products.lookupBarcode(barcode);
      if (!product) {
        resultDiv.innerHTML = `<div class="alert-card danger"><span class="alert-icon">❌</span><span class="alert-text">Barcode "${barcode}" not found</span></div>`;
        scannedProduct = null;
        document.getElementById('inv-stockin-form').classList.add('hidden');
        return;
      }

      scannedProduct = product;
      resultDiv.innerHTML = `<div class="alert-card info"><span class="alert-icon">✅</span><span class="alert-text">Found: <strong>${product.product_name}</strong></span></div>`;
      document.getElementById('inv-product-name').value = product.product_name;
      document.getElementById('inv-current-stock').value = product.stock_quantity;
      document.getElementById('inv-add-qty').value = '';
      if(document.getElementById('inv-batch-no')) document.getElementById('inv-batch-no').value = '';
      if(document.getElementById('inv-expiry-date')) document.getElementById('inv-expiry-date').value = '';
      document.getElementById('inv-stockin-form').classList.remove('hidden');
      document.getElementById('inv-add-qty').focus();
    } catch (err) {
      resultDiv.innerHTML = `<div class="alert-card danger"><span class="alert-icon">❌</span><span class="alert-text">Scan error</span></div>`;
    }
  }

  async function saveStockIn() {
    if (!scannedProduct) return;
    const qty = parseInt(document.getElementById('inv-add-qty').value);
    if (!qty || qty < 1) { showToast('Enter a valid quantity', 'warning'); return; }

    try {
      const result = await window.api.inventory.stockIn({
        barcode: scannedProduct.barcode,
        quantity: qty,
        batchNumber: document.getElementById('inv-batch-no') ? document.getElementById('inv-batch-no').value.trim() : '',
        expiryDate: document.getElementById('inv-expiry-date') ? document.getElementById('inv-expiry-date').value : '',
        userId: typeof currentUser !== 'undefined' && currentUser ? currentUser.id : null,
      });

      if (result.success) {
        sessionLog.unshift({
          name: scannedProduct.product_name,
          barcode: scannedProduct.barcode,
          qty,
          newStock: result.product.stock_quantity,
          time: new Date().toLocaleTimeString(),
        });
        renderSessionLog();

        showToast(`Added ${qty} units to <strong>${scannedProduct.product_name}</strong>`, 'success');
        scannedProduct = null;
        document.getElementById('inv-stockin-form').classList.add('hidden');
        document.getElementById('inv-scan-result').innerHTML = '';
        document.getElementById('inv-scanner').focus();
      } else {
        showToast(result.error || 'Stock in failed', 'error');
      }
    } catch (err) {
      showToast('Error: ' + (err.message || 'saving stock'), 'error');
    }
  }

  function renderSessionLog() {
    const logDiv = document.getElementById('inv-session-log');
    if (sessionLog.length === 0) {
      logDiv.innerHTML = '<div class="empty-state"><span class="empty-icon">📭</span><p>No items scanned yet</p></div>';
      return;
    }
    logDiv.innerHTML = sessionLog.map(item => `
      <div class="list-item">
        <div class="li-icon">📥</div>
        <div class="li-content">
          <div class="li-title">${item.name}</div>
          <div class="li-meta">${item.barcode} · +${item.qty} units · Now: ${item.newStock} · ${item.time}</div>
        </div>
      </div>
    `).join('');
  }

  async function loadAdjustments() {
    const tbody = document.getElementById('inv-adjust-tbody');
    try {
      const adjustments = await window.api.inventory.getAdjustments({});
      if (adjustments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-muted);">No adjustments recorded</td></tr>';
        return;
      }
      tbody.innerHTML = adjustments.map(a => {
        const typeColors = { add: 'badge-green', reduce: 'badge-rose', stock_in: 'badge-teal', sale: 'badge-amber', purchase: 'badge-blue' };
        return `<tr>
          <td class="fw-700">${a.product_name || '—'}</td>
          <td><span class="badge ${typeColors[a.adjustment_type] || 'badge-teal'}">${a.adjustment_type}</span></td>
          <td class="fw-700">${a.quantity}</td>
          <td class="text-sm">${a.reason || '—'}</td>
          <td class="text-sm text-muted">${a.user_name || '—'}</td>
          <td class="text-sm text-muted">${formatDate(a.created_at)}</td>
        </tr>`;
      }).join('');
    } catch (err) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--accent-rose);">Error loading adjustments</td></tr>';
    }
  }

  async function loadAuditData() {
    const tbody = document.getElementById('inv-audit-tbody');
    try {
      const products = await window.api.inventory.auditData();
      if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-muted);">No products to audit</td></tr>';
        return;
      }
      tbody.innerHTML = products.map(p => `
        <tr>
          <td class="font-mono text-sm">${p.barcode}</td>
          <td class="fw-700">${p.product_name}</td>
          <td class="fw-700">${p.stock_quantity}</td>
          <td>
            <input type="number" class="form-input" style="width:80px;padding:6px 8px;font-size:13px;"
              data-audit-id="${p.id}" data-system-qty="${p.stock_quantity}" value="${p.stock_quantity}" min="0">
          </td>
          <td class="audit-variance" data-var-id="${p.id}">
            <span class="badge badge-green">Match</span>
          </td>
        </tr>
      `).join('');

      // Variance calculation
      tbody.querySelectorAll('input[data-audit-id]').forEach(input => {
        input.addEventListener('input', () => {
          const systemQty = parseInt(input.dataset.systemQty);
          const physicalQty = parseInt(input.value) || 0;
          const diff = physicalQty - systemQty;
          const varCell = tbody.querySelector(`[data-var-id="${input.dataset.auditId}"]`);
          if (diff === 0) {
            varCell.innerHTML = '<span class="badge badge-green">Match</span>';
          } else if (diff > 0) {
            varCell.innerHTML = `<span class="badge badge-blue">+${diff}</span>`;
          } else {
            varCell.innerHTML = `<span class="badge badge-rose">${diff}</span>`;
          }
        });
      });
    } catch (err) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--accent-rose);">Error loading audit data</td></tr>';
    }
  }

  async function saveStockAdjustment() {
    const productId = parseInt(document.getElementById('adjust-product-id').value);
    const type = document.getElementById('adjust-type').value;
    const qty = parseInt(document.getElementById('adjust-qty').value);
    const reason = document.getElementById('adjust-reason').value.trim();

    if (!qty || qty < 1) { showToast('Enter a valid quantity', 'warning'); return; }
    if (!reason) { showToast('Reason is required', 'warning'); return; }

    try {
      const result = await window.api.inventory.adjust({
        productId, type, quantity: qty, reason,
        userId: typeof currentUser !== 'undefined' && currentUser ? currentUser.id : null,
      });
      if (result.success) {
        closeModal('modal-stock-adjust');
        showToast(`Stock ${type === 'add' ? 'increased' : 'reduced'} by ${qty}`, 'success');
        if (activeTab === 'adjustments') loadAdjustments();
      } else {
        showToast(result.error || 'Adjustment failed', 'error');
      }
    } catch (err) {
      showToast('Error: ' + (err.message || 'saving adjustment'), 'error');
    }
  }

  async function loadBatches(onlyExpiring = false) {
    const div = document.getElementById('batches-content');
    try {
      const batches = onlyExpiring 
        ? await window.api.batches.getExpiring(30) 
        : await window.api.batches.getExpiring(99999);

      if (batches.length === 0) {
        div.innerHTML = `<div class="alert-card info"><span class="alert-icon">✅</span><span class="alert-text">${onlyExpiring ? 'No batches expiring in the next 30 days' : 'No batches found. Add batches during product creation or stock in.'}</span></div>`;
        return;
      }
      div.innerHTML = `<div class="data-table-wrap"><table class="data-table"><thead><tr>
        <th>Product</th><th>Batch #</th><th>Expiry Date</th><th>Qty</th><th>Status</th>
      </tr></thead><tbody>${batches.map(b => {
        const isExpired = new Date(b.expiry_date) <= new Date();
        const expiringSoon = new Date(b.expiry_date) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        let statusBadge = '<span class="badge badge-teal">OK</span>';
        if (isExpired) statusBadge = '<span class="badge badge-rose">EXPIRED</span>';
        else if (expiringSoon) statusBadge = '<span class="badge badge-amber">EXPIRING</span>';

        return `<tr>
          <td class="fw-700">${b.product_name}</td>
          <td class="font-mono text-sm">${b.batch_number}</td>
          <td>${formatDateShort(b.expiry_date)}</td>
          <td>${b.quantity}</td>
          <td>${statusBadge}</td>
        </tr>`;
      }).join('')}</tbody></table></div>`;
    } catch (err) {
      div.innerHTML = '<div class="alert-card danger"><span class="alert-icon">❌</span><span class="alert-text">Error loading batches</span></div>';
    }
  }

  function exportAuditCSV() {
    const rows = document.querySelectorAll('#inv-audit-tbody tr');
    let csv = 'Barcode,Product,System Qty,Physical Qty,Variance\n';
    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 4) {
        const barcode = cells[0].textContent.trim();
        const name = cells[1].textContent.trim();
        const sysQty = cells[2].textContent.trim();
        const input = cells[3].querySelector('input');
        const physQty = input ? input.value : sysQty;
        const variance = parseInt(physQty) - parseInt(sysQty);
        csv += `"${barcode}","${name}",${sysQty},${physQty},${variance}\n`;
      }
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-audit-${getToday()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Audit data exported to CSV', 'success');
  }

  return { init, saveStockAdjustment };
})();
