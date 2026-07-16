// ═══════════════════════════════════════════════════════════════════════════
//  UI/inventory.js — Inventory Management Module
//  Stock In (barcode scan), Stock Adjustment, Inventory Audit, Batch tracking.
// ═══════════════════════════════════════════════════════════════════════════

const InventoryModule = (() => {
  const panel = document.getElementById('panel-inventory');
  let initialized = false;
  let activeTab = 'adjustments';

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
        <p>Adjustments, Audit, and Expiry Tracking</p>
      </div>

      <div class="tab-bar">
        <button class="tab-btn active" data-tab="adjustments">📊 Adjustments</button>
        <button class="tab-btn" data-tab="audit">🔍 Audit</button>
        <button class="tab-btn" data-tab="batches">📋 Expiry Items</button>
      </div>

      <!-- Stock In (Removed) -->
      <!-- Adjustments History -->
      <div class="tab-pane active" id="inv-tab-adjustments">
        <div class="page-toolbar">
          <p class="text-muted text-sm">View and manage stock adjustments</p>
          <button class="btn btn-primary" id="btn-new-adjustment"><i data-lucide="plus"></i> New Adjustment</button>
        </div>
        <div class="card" style="padding:0;">
          <div class="data-table-wrap" style="max-height:calc(100vh - 310px);">
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

      <!-- Expiry Items -->
      <div class="tab-pane" id="inv-tab-batches">
        <div class="page-toolbar">
          <p class="text-muted text-sm">Track expiry items and their dates</p>
          <button class="btn btn-secondary" id="btn-view-expiring">⚠️ View Expiring</button>
        </div>
        <div id="batches-content">
          <div class="empty-state"><span class="empty-icon">📋</span><p>Loading expiry items...</p></div>
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

    document.getElementById('btn-new-adjustment').addEventListener('click', () => {
      document.getElementById('adjust-product-id').value = '';
      document.getElementById('adjust-product-name').value = '';
      const searchInput = document.getElementById('adjust-product-search');
      if (searchInput) searchInput.value = '';
      document.getElementById('adjust-type').value = 'add';
      document.getElementById('adjust-qty').value = '';
      document.getElementById('adjust-reason').value = '';
      openModal('modal-stock-adjust');
    });

    document.getElementById('btn-adjust-lookup').addEventListener('click', async () => {
      const searchStr = document.getElementById('adjust-product-search').value.trim();
      if (!searchStr) {
        showToast('Please enter a barcode', 'warning');
        return;
      }
      try {
        const p = await window.api.products.lookupBarcode(searchStr);
        if (p) {
          document.getElementById('adjust-product-id').value = p.id;
          document.getElementById('adjust-product-name').value = p.product_name;
          showToast('Product found', 'success');
        } else {
          showToast('Product not found', 'warning');
          document.getElementById('adjust-product-id').value = '';
          document.getElementById('adjust-product-name').value = '';
        }
      } catch (err) {
        showToast('Error looking up product', 'error');
      }
    });

    document.getElementById('adjust-product-search').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('btn-adjust-lookup').click();
      }
    });

    // Auto-fetch product when typing/scanning barcode
    document.getElementById('adjust-product-search').addEventListener('input', async (e) => {
      const searchStr = e.target.value.trim();
      if (!searchStr) return;
      try {
        const p = await window.api.products.lookupBarcode(searchStr);
        if (p) {
          document.getElementById('adjust-product-id').value = p.id;
          document.getElementById('adjust-product-name').value = p.product_name;
        }
      } catch (err) {
        // fail silently for input event
      }
    });

    // Audit export
    document.getElementById('btn-export-audit').addEventListener('click', exportAuditCSV);

    // Expiry Items
    document.getElementById('btn-view-expiring').addEventListener('click', () => loadBatches(true));
  }

  function switchTab(tab) {
    panel.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    panel.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    const pane = document.getElementById('inv-tab-' + tab);
    if (pane) pane.classList.add('active');

    if (tab === 'adjustments') loadAdjustments();
    if (tab === 'audit') loadAuditData();
    if (tab === 'batches') loadBatches(false);
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
        div.innerHTML = `<div class="alert-card info"><span class="alert-icon">✅</span><span class="alert-text">${onlyExpiring ? 'No expiry items in the next 30 days' : 'No expiry items found. Add expiry items during product creation or stock in.'}</span></div>`;
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
      div.innerHTML = '<div class="alert-card danger"><span class="alert-icon">❌</span><span class="alert-text">Error loading expiry items</span></div>';
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
