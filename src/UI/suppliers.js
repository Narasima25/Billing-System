// ═══════════════════════════════════════════════════════════════════════════
//  UI/suppliers.js — Supplier Management Module
//  CRUD for suppliers with purchase history view.
// ═══════════════════════════════════════════════════════════════════════════

const SuppliersModule = (() => {
  const panel = document.getElementById('panel-suppliers');
  let initialized = false;

  function init() {
    if (!initialized) {
      render();
      bindEvents();
      initialized = true;
    }
    loadSuppliers();
  }

  function render() {
    panel.innerHTML = `
      <div class="page-toolbar">
        <div>
          <h2 style="font-size:20px;font-weight:800;margin-bottom:4px;">🏢 Supplier Management</h2>
          <p class="text-muted text-sm">Manage your product suppliers</p>
        </div>
        <div class="btn-group">
          <button class="btn btn-secondary" id="btn-new-purchase">🛍️ New Purchase</button>
          <button class="btn btn-primary" id="btn-add-supplier">+ Add Supplier</button>
        </div>
      </div>

      <div class="card" style="padding:0;">
        <div class="data-table-wrap" style="max-height:calc(100vh - 220px);">
          <table class="data-table">
            <thead>
              <tr>
                <th>Supplier Name</th>
                <th>Contact Person</th>
                <th>Mobile</th>
                <th>Email</th>
                <th>GST Number</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="suppliers-tbody">
              <tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted);">Loading...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Purchase History Sub-Panel -->
      <div class="modal-overlay" id="modal-supplier-history">
        <div class="modal-box lg">
          <div class="modal-header">
            <div class="modal-title" id="supplier-history-title">📋 Purchase History</div>
            <button class="modal-close" onclick="closeModal('modal-supplier-history')">✕</button>
          </div>
          <div id="supplier-history-content"></div>
        </div>
      </div>
    `;
  }

  function bindEvents() {
    document.getElementById('btn-add-supplier').addEventListener('click', () => openSupplierModal());

    document.getElementById('btn-save-supplier').addEventListener('click', saveSupplier);
    document.getElementById('form-supplier').addEventListener('submit', (e) => { e.preventDefault(); saveSupplier(); });

    document.getElementById('btn-new-purchase').addEventListener('click', openPurchaseModal);
    document.getElementById('btn-save-purchase').addEventListener('click', savePurchase);
    document.getElementById('form-purchase').addEventListener('submit', (e) => { e.preventDefault(); savePurchase(); });

    // Purchase barcode scan
    document.getElementById('purchase-barcode').addEventListener('keydown', async (e) => {
      if (e.key !== 'Enter') return;
      const barcode = e.target.value.trim();
      e.target.value = '';
      if (!barcode) return;
      await addPurchaseItem(barcode);
    });

    // Table actions
    document.getElementById('suppliers-tbody').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const id = parseInt(btn.dataset.id);
      if (btn.dataset.action === 'edit') editSupplier(id);
      if (btn.dataset.action === 'delete') deleteSupplier(id);
      if (btn.dataset.action === 'history') viewHistory(id, btn.dataset.name);
    });
  }

  async function loadSuppliers() {
    const tbody = document.getElementById('suppliers-tbody');
    try {
      const suppliers = await window.api.suppliers.getAll();
      if (suppliers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted);">No suppliers yet</td></tr>';
        return;
      }
      tbody.innerHTML = suppliers.map(s => `<tr>
        <td class="fw-700">${s.name}</td>
        <td>${s.contact_person || '—'}</td>
        <td class="font-mono text-sm">${s.mobile || '—'}</td>
        <td class="text-sm">${s.email || '—'}</td>
        <td class="text-sm">${s.gst_number || '—'}</td>
        <td>
          <div class="btn-group" style="gap:4px;">
            <button class="btn btn-ghost btn-sm" data-action="history" data-id="${s.id}" data-name="${s.name}">📋</button>
            <button class="btn btn-ghost btn-sm" data-action="edit" data-id="${s.id}">✏️</button>
            <button class="btn btn-ghost btn-sm" data-action="delete" data-id="${s.id}">🗑️</button>
          </div>
        </td>
      </tr>`).join('');
    } catch (err) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--accent-rose);">Error loading suppliers</td></tr>';
    }
  }

  function openSupplierModal(supplier = null) {
    document.getElementById('modal-supplier-title').textContent = supplier ? '✏️ Edit Supplier' : '🏢 Add Supplier';
    document.getElementById('supplier-edit-id').value = supplier ? supplier.id : '';
    document.getElementById('sup-name').value = supplier ? supplier.name : '';
    document.getElementById('sup-contact').value = supplier ? (supplier.contact_person || '') : '';
    document.getElementById('sup-mobile').value = supplier ? (supplier.mobile || '') : '';
    document.getElementById('sup-email').value = supplier ? (supplier.email || '') : '';
    document.getElementById('sup-gst').value = supplier ? (supplier.gst_number || '') : '';
    document.getElementById('sup-address').value = supplier ? (supplier.address || '') : '';
    openModal('modal-supplier');
  }

  async function saveSupplier() {
    const editId = document.getElementById('supplier-edit-id').value;
    const data = {
      name: document.getElementById('sup-name').value.trim(),
      contactPerson: document.getElementById('sup-contact').value.trim(),
      mobile: document.getElementById('sup-mobile').value.trim(),
      email: document.getElementById('sup-email').value.trim(),
      gstNumber: document.getElementById('sup-gst').value.trim(),
      address: document.getElementById('sup-address').value.trim(),
    };
    if (!data.name) { showToast('Supplier name is required', 'warning'); return; }

    try {
      let result;
      if (editId) {
        data.id = parseInt(editId);
        result = await window.api.suppliers.update(data);
      } else {
        result = await window.api.suppliers.add(data);
      }
      if (result.success) {
        closeModal('modal-supplier');
        loadSuppliers();
        showToast(editId ? 'Supplier updated' : 'Supplier added', 'success');
      } else {
        showToast(result.error || 'Save failed', 'error');
      }
    } catch (err) {
      showToast('Save error', 'error');
    }
  }

  async function editSupplier(id) {
    const suppliers = await window.api.suppliers.getAll();
    const supplier = suppliers.find(s => s.id === id);
    if (supplier) openSupplierModal(supplier);
  }

  async function deleteSupplier(id) {
    if (!confirm('Deactivate this supplier?')) return;
    const result = await window.api.suppliers.delete(id);
    if (result.success) { loadSuppliers(); showToast('Supplier removed', 'success'); }
    else showToast(result.error || 'Delete failed', 'error');
  }

  async function viewHistory(id, name) {
    document.getElementById('supplier-history-title').textContent = `📋 Purchases from ${name}`;
    const purchases = await window.api.suppliers.getPurchases(id);
    const div = document.getElementById('supplier-history-content');
    if (purchases.length === 0) {
      div.innerHTML = '<p class="text-muted" style="padding:20px;text-align:center;">No purchase history</p>';
    } else {
      div.innerHTML = `<div class="data-table-wrap"><table class="data-table"><thead><tr>
        <th>Invoice #</th><th>Total</th><th>Items</th><th>Date</th>
      </tr></thead><tbody>${purchases.map(p => `<tr>
        <td class="fw-700 font-mono text-sm">${p.invoice_number || '—'}</td>
        <td class="fw-700 text-teal">${formatRupees(p.total_paise)}</td>
        <td>${p.item_count}</td>
        <td class="text-sm text-muted">${formatDate(p.created_at)}</td>
      </tr>`).join('')}</tbody></table></div>`;
    }
    openModal('modal-supplier-history');
  }

  // ─── Purchase Entry ──────────────────────────────────────────────────
  let purchaseItems = [];

  async function openPurchaseModal() {
    purchaseItems = [];
    document.getElementById('purchase-invoice').value = '';
    document.getElementById('purchase-barcode').value = '';
    renderPurchaseItems();

    // Load suppliers into dropdown
    const suppliers = await window.api.suppliers.getAll();
    document.getElementById('purchase-supplier').innerHTML =
      '<option value="">— Select Supplier —</option>' +
      suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

    openModal('modal-purchase');
  }

  async function addPurchaseItem(barcode) {
    const product = await window.api.products.lookupBarcode(barcode);
    if (!product) { showToast(`Barcode "${barcode}" not found`, 'error'); return; }

    const existing = purchaseItems.find(i => i.productId === product.id);
    if (existing) {
      existing.quantity++;
    } else {
      purchaseItems.push({
        productId: product.id,
        productName: product.product_name,
        barcode: product.barcode,
        quantity: 1,
        unitCostPaise: product.purchase_price_paise || 0,
      });
    }
    renderPurchaseItems();
  }

  function renderPurchaseItems() {
    const div = document.getElementById('purchase-items-list');
    if (purchaseItems.length === 0) {
      div.innerHTML = '<p class="text-muted text-sm" style="padding:12px 0;">Scan product barcodes to add items</p>';
      return;
    }
    let total = 0;
    div.innerHTML = `<div class="data-table-wrap"><table class="data-table"><thead><tr>
      <th>Product</th><th>Qty</th><th>Unit Cost (₹)</th><th>Total</th><th></th>
    </tr></thead><tbody>${purchaseItems.map((item, idx) => {
      const lineTotal = item.unitCostPaise * item.quantity;
      total += lineTotal;
      return `<tr>
        <td class="fw-700">${item.productName}</td>
        <td><input type="number" class="form-input" style="width:60px;padding:4px 8px;font-size:13px;"
          value="${item.quantity}" min="1" onchange="SuppliersModule._updatePurchaseQty(${idx}, this.value)"></td>
        <td><input type="number" class="form-input" style="width:100px;padding:4px 8px;font-size:13px;"
          value="${(item.unitCostPaise/100).toFixed(2)}" step="0.01" min="0"
          onchange="SuppliersModule._updatePurchaseCost(${idx}, this.value)"></td>
        <td class="fw-700">${formatRupees(lineTotal)}</td>
        <td><button class="btn btn-ghost btn-sm" onclick="SuppliersModule._removePurchaseItem(${idx})">✕</button></td>
      </tr>`;
    }).join('')}</tbody></table></div>
    <div style="text-align:right;font-size:16px;font-weight:800;margin-top:8px;">Total: <span class="text-teal">${formatRupees(total)}</span></div>`;
  }

  async function savePurchase() {
    const supplierId = document.getElementById('purchase-supplier').value;
    const invoiceNumber = document.getElementById('purchase-invoice').value.trim();
    if (!supplierId) { showToast('Select a supplier', 'warning'); return; }
    if (purchaseItems.length === 0) { showToast('Add at least one item', 'warning'); return; }

    try {
      const result = await window.api.purchases.add({
        supplierId: parseInt(supplierId),
        invoiceNumber,
        items: purchaseItems.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
          unitCostPaise: i.unitCostPaise,
        })),
      });
      if (result.success) {
        closeModal('modal-purchase');
        showToast('Purchase recorded — inventory updated', 'success');
        loadSuppliers();
      } else {
        showToast(result.error || 'Save failed', 'error');
      }
    } catch (err) {
      showToast('Error saving purchase', 'error');
    }
  }

  return {
    init,
    _updatePurchaseQty: (idx, val) => { purchaseItems[idx].quantity = parseInt(val) || 1; renderPurchaseItems(); },
    _updatePurchaseCost: (idx, val) => { purchaseItems[idx].unitCostPaise = parseRupeesToPaise(val); renderPurchaseItems(); },
    _removePurchaseItem: (idx) => { purchaseItems.splice(idx, 1); renderPurchaseItems(); },
  };
})();
