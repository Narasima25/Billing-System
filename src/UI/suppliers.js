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

      <!-- Products from Supplier Sub-Panel -->
      <div class="modal-overlay" id="modal-supplier-products">
        <div class="modal-box lg">
          <div class="modal-header">
            <div class="modal-title" id="supplier-products-title">📦 Products</div>
            <button class="modal-close" onclick="closeModal('modal-supplier-products')">✕</button>
          </div>
          <div id="supplier-products-content"></div>
        </div>
      </div>
    `;
  }

  function bindEvents() {
    document.getElementById('btn-add-supplier').addEventListener('click', () => openSupplierModal());

    document.getElementById('btn-save-supplier').addEventListener('click', saveSupplier);
    document.getElementById('form-supplier').addEventListener('submit', (e) => { e.preventDefault(); saveSupplier(); });

    // Table actions
    document.getElementById('suppliers-tbody').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const id = parseInt(btn.dataset.id);
      if (btn.dataset.action === 'edit') editSupplier(id);
      if (btn.dataset.action === 'delete') deleteSupplier(id);
      if (btn.dataset.action === 'history') viewHistory(id, btn.dataset.name);
      if (btn.dataset.action === 'products') viewProducts(id, btn.dataset.name);
      if (btn.dataset.action === 'add-purchase') openAddPurchase(id, btn.dataset.name);
    });

    document.getElementById('btn-add-purchase-item').addEventListener('click', addPurchaseItemRow);
    document.getElementById('btn-save-purchase').addEventListener('click', savePurchase);
    document.getElementById('form-add-purchase').addEventListener('submit', (e) => { e.preventDefault(); savePurchase(); });
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
        <td>
          <div class="btn-group" style="gap:4px;">
            <button class="btn btn-ghost btn-sm" data-action="add-purchase" data-id="${s.id}" data-name="${s.name}" title="Add Purchase">➕</button>
            <button class="btn btn-ghost btn-sm" data-action="history" data-id="${s.id}" data-name="${s.name}" title="Purchase History">📋</button>
            <button class="btn btn-ghost btn-sm" data-action="products" data-id="${s.id}" data-name="${s.name}" title="Products Supplied">📦</button>
            <button class="btn btn-ghost btn-sm" data-action="edit" data-id="${s.id}" title="Edit">✏️</button>
            <button class="btn btn-ghost btn-sm" data-action="delete" data-id="${s.id}" title="Delete">🗑️</button>
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

  async function viewProducts(id, name) {
    document.getElementById('supplier-products-title').textContent = `📦 Products supplied by ${name}`;
    const div = document.getElementById('supplier-products-content');
    div.innerHTML = '<p class="text-muted" style="padding:20px;text-align:center;">Loading products...</p>';
    openModal('modal-supplier-products');

    try {
      const data = await window.api.products.getAll({ supplierId: id, perPage: 100 });
      const products = data.products;
      if (products.length === 0) {
        div.innerHTML = '<p class="text-muted" style="padding:20px;text-align:center;">No products found for this supplier</p>';
      } else {
        div.innerHTML = `<div class="data-table-wrap" style="max-height: 400px;"><table class="data-table"><thead><tr>
          <th>Product Name</th><th>Barcode</th><th>Category</th><th>Selling Price</th><th>Stock</th>
        </tr></thead><tbody>${products.map(p => {
          const isOOS = p.stock_quantity <= 0;
          return `<tr>
          <td class="fw-700">${p.product_name}</td>
          <td class="font-mono text-sm">${p.barcode}</td>
          <td class="text-sm">${p.category_name || '—'}</td>
          <td class="fw-700">${formatRupees(p.selling_price_paise)}</td>
          <td class="fw-700 ${isOOS ? 'text-rose' : 'text-green'}">${p.stock_quantity}</td>
        </tr>`;
        }).join('')}</tbody></table></div>`;
      }
    } catch (err) {
      div.innerHTML = '<p class="text-rose" style="padding:20px;text-align:center;">Error loading products</p>';
    }
  }

  // ─── Add Purchase Logic ──────────────────────────────────────────────────
  let currentSupplierProducts = [];

  async function openAddPurchase(supplierId, supplierName) {
    document.getElementById('purchase-supplier-id').value = supplierId;
    document.getElementById('purchase-supplier-name').value = supplierName;
    document.getElementById('purchase-invoice-number').value = '';
    document.getElementById('purchase-notes').value = '';
    document.getElementById('purchase-items-tbody').innerHTML = '';
    document.getElementById('purchase-grand-total').textContent = '0.00';

    openModal('modal-add-purchase');

    // Load products for this supplier
    try {
      const data = await window.api.products.getAll({ supplierId: supplierId, perPage: 1000 });
      currentSupplierProducts = data.products || [];
      addPurchaseItemRow(); // Add one empty row by default
    } catch (err) {
      showToast('Error loading products for supplier', 'error');
      currentSupplierProducts = [];
    }
  }

  function addPurchaseItemRow() {
    const tbody = document.getElementById('purchase-items-tbody');
    const tr = document.createElement('tr');
    tr.className = 'purchase-item-row';

    const productOptions = currentSupplierProducts.map(p => 
      `<option value="${p.id}" data-cost="${p.purchase_price_paise || 0}">${p.product_name} (${p.barcode})</option>`
    ).join('');

    tr.innerHTML = `
      <td>
        <select class="form-select purchase-product-select" required>
          <option value="">— Select Product —</option>
          ${productOptions}
        </select>
      </td>
      <td>
        <input type="number" class="form-input purchase-qty" value="1" min="1" required style="width: 100%;">
      </td>
      <td>
        <input type="number" class="form-input purchase-cost" value="0.00" step="0.01" min="0" required style="width: 100%;">
      </td>
      <td class="fw-700 text-teal purchase-line-total">₹0.00</td>
      <td>
        <button type="button" class="btn btn-ghost btn-sm btn-remove-item" title="Remove" style="color:var(--accent-rose);">✕</button>
      </td>
    `;

    tbody.appendChild(tr);

    // Bind events for this row
    const select = tr.querySelector('.purchase-product-select');
    const qty = tr.querySelector('.purchase-qty');
    const cost = tr.querySelector('.purchase-cost');
    const removeBtn = tr.querySelector('.btn-remove-item');

    select.addEventListener('change', (e) => {
      const option = e.target.selectedOptions[0];
      if (option && option.value) {
        cost.value = (parseInt(option.dataset.cost) / 100).toFixed(2);
      } else {
        cost.value = '0.00';
      }
      updatePurchaseTotal();
    });

    qty.addEventListener('input', updatePurchaseTotal);
    cost.addEventListener('input', updatePurchaseTotal);

    removeBtn.addEventListener('click', () => {
      tr.remove();
      updatePurchaseTotal();
    });
  }

  function updatePurchaseTotal() {
    const rows = document.querySelectorAll('.purchase-item-row');
    let grandTotalPaise = 0;

    rows.forEach(row => {
      const qtyStr = row.querySelector('.purchase-qty').value;
      const costStr = row.querySelector('.purchase-cost').value;
      const qty = parseInt(qtyStr) || 0;
      const cost = parseFloat(costStr) || 0;
      
      const lineTotalPaise = Math.round(qty * cost * 100);
      row.querySelector('.purchase-line-total').textContent = formatRupees(lineTotalPaise);
      
      grandTotalPaise += lineTotalPaise;
    });

    document.getElementById('purchase-grand-total').textContent = (grandTotalPaise / 100).toFixed(2);
  }

  async function savePurchase() {
    const supplierId = parseInt(document.getElementById('purchase-supplier-id').value);
    const invoiceNumber = document.getElementById('purchase-invoice-number').value.trim();
    const notes = document.getElementById('purchase-notes').value.trim();
    
    const items = [];
    const rows = document.querySelectorAll('.purchase-item-row');
    
    for (const row of rows) {
      const select = row.querySelector('.purchase-product-select');
      const productId = select.value;
      const qty = parseInt(row.querySelector('.purchase-qty').value) || 0;
      const cost = parseFloat(row.querySelector('.purchase-cost').value) || 0;
      
      if (productId && qty > 0) {
        items.push({
          productId: parseInt(productId),
          quantity: qty,
          unitCostPaise: Math.round(cost * 100)
        });
      }
    }

    if (items.length === 0) {
      showToast('Please add at least one valid product to the purchase', 'warning');
      return;
    }

    const btn = document.getElementById('btn-save-purchase');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
      const result = await window.api.purchases.add({
        supplierId,
        invoiceNumber,
        items,
        notes
      });

      if (result.success) {
        showToast('Purchase saved successfully!', 'success');
        closeModal('modal-add-purchase');
        // If we want, we can show history immediately, but let's just close for now
      } else {
        showToast(result.error || 'Failed to save purchase', 'error');
      }
    } catch (err) {
      showToast('Error saving purchase', 'error');
    }

    btn.disabled = false;
    btn.textContent = 'Save Purchase';
  }

  return {
    init,
  };
})();
