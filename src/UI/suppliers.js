// ═══════════════════════════════════════════════════════════════════════════
//  UI/suppliers.js — Supplier Management Module
//  CRUD for suppliers with purchase history view.
// ═══════════════════════════════════════════════════════════════════════════

const SuppliersModule = (() => {
  const panel = document.getElementById('panel-suppliers');
  let initialized = false;
  let loadedSuppliers = [];

  function init() {
    if (!initialized) {
      render();
      bindEvents();
      initialized = true;
    }
    loadSuppliers();
    loadLedger();
  }

  function render() {
    panel.innerHTML = `
      <div class="page-toolbar">
        <div>
          <h2 style="font-size:20px;font-weight:800;margin-bottom:4px;">🏢 Supplier Management</h2>
          <p class="text-muted text-sm">Manage your product suppliers</p>
        </div>
        <div class="btn-group" style="align-items: center; gap: 16px;">
          <input type="text" id="supplier-search" class="form-input" placeholder="Search supplier or invoice..." style="width: 250px;">
          <label style="font-size:13px; display:flex; align-items:center; gap:5px; cursor:pointer;">
            <input type="checkbox" id="show-inactive-suppliers"> Show Deactivated
          </label>
          <button class="btn btn-primary" id="btn-add-supplier">+ Add Supplier</button>
        </div>
      </div>

      <div class="report-summary mt-8 mb-12" id="supplier-ledger-summary">
        <div class="summary-card"><span class="sc-value text-teal" id="ledger-itc">₹0.00</span><span class="sc-label">Total Tax Claims (ITC)</span></div>
      </div>

      <div class="card" style="padding:0;">
        <div class="data-table-wrap" style="max-height:calc(100vh - 300px);">
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
              <tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted);">Loading...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Purchase History Sub-Panel -->
      <div class="modal-overlay" id="modal-supplier-history">
        <div class="modal-box lg">
          <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap: 16px;">
              <div class="modal-title" id="supplier-history-title">📋 Purchase History</div>
              <input type="text" id="purchase-history-search" class="form-input" placeholder="Search invoice..." style="width: 200px;">
            </div>
            <button class="modal-close" onclick="closeModal('modal-supplier-history')">✕</button>
          </div>
          <div id="supplier-history-content"></div>
        </div>
      </div>

    `;
  }

  function bindEvents() {
    document.getElementById('btn-add-supplier').addEventListener('click', () => openSupplierModal());

    document.getElementById('form-supplier').addEventListener('submit', (e) => { e.preventDefault(); saveSupplier(); });

    // Table actions
    document.getElementById('suppliers-tbody').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const id = parseInt(btn.dataset.id);
      if (btn.dataset.action === 'edit') editSupplier(id);
      if (btn.dataset.action === 'delete') deleteSupplier(id);
      if (btn.dataset.action === 'hard-delete') hardDeleteSupplier(id);
      if (btn.dataset.action === 'restore') restoreSupplier(id);
      if (btn.dataset.action === 'history') viewHistory(id, btn.dataset.name);
      if (btn.dataset.action === 'add-purchase') openAddPurchase(id, btn.dataset.name, btn.dataset.gstin);
    });

    document.getElementById('show-inactive-suppliers').addEventListener('change', loadSuppliers);

    document.getElementById('supplier-search').addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase();
      const rows = document.getElementById('suppliers-tbody').querySelectorAll('tr');
      rows.forEach(row => {
        if(row.children.length === 1) return; // Empty state row
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(term) ? '' : 'none';
      });
    });

    document.getElementById('purchase-history-search').addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase();
      const content = document.getElementById('supplier-history-content');
      if (!content) return;
      const rows = content.querySelectorAll('tbody tr');
      rows.forEach(row => {
        if(row.children.length === 1) return;
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(term) ? '' : 'none';
      });
    });

    document.getElementById('btn-save-purchase-item').addEventListener('click', () => addPurchaseItemSubmit());
    document.getElementById('btn-draft-purchase').addEventListener('click', () => savePurchase(true));
    document.getElementById('form-add-purchase').addEventListener('submit', (e) => { e.preventDefault(); savePurchase(false); });
    document.getElementById('purchase-round-off').addEventListener('input', updatePurchaseTotal);
    
    document.getElementById('purchase-summary-gst').addEventListener('input', (e) => {
      e.target.dataset.edited = 'true';
      updatePurchaseTotal();
    });

    document.getElementById('purchase-grand-total').addEventListener('input', (e) => {
      // no-op, always auto-calculates now
    });

    // Auto-adjustments between Base Price and Final Purchase have been removed as per user request.
  }

  async function loadSuppliers() {
    const tbody = document.getElementById('suppliers-tbody');
    const includeInactive = document.getElementById('show-inactive-suppliers')?.checked || false;
    try {
      const suppliers = await window.api.suppliers.getAll({ includeInactive });
      loadedSuppliers = suppliers;
      if (suppliers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted);">No suppliers yet</td></tr>';
        return;
      }
      tbody.innerHTML = suppliers.map(s => `<tr>
        <td class="fw-700">
          ${s.name} ${s.is_active === 0 ? '<span class="badge badge-rose" style="font-size:10px;margin-left:4px;">Deactivated</span>' : ''}
        </td>
        <td>${s.contact_person || '—'}</td>
        <td class="font-mono text-sm">${s.mobile || '—'}</td>
        <td class="text-sm">${s.email || '—'}</td>
        <td>
          <div class="btn-group" style="gap:4px;">
            ${s.is_active === 1 ? `
            <button class="btn btn-ghost btn-sm" data-action="add-purchase" data-id="${s.id}" data-name="${s.name}" data-gstin="${s.gst_number || ''}" title="Add Purchase">➕</button>
            <button class="btn btn-ghost btn-sm" data-action="history" data-id="${s.id}" data-name="${s.name}" title="Purchase History">📋</button>
            <button class="btn btn-ghost btn-sm" data-action="edit" data-id="${s.id}" title="Edit">✏️</button>
            <button class="btn btn-ghost btn-sm" data-action="delete" data-id="${s.id}" title="Deactivate">🗑️</button>
            ` : `
            <button class="btn btn-ghost btn-sm" data-action="restore" data-id="${s.id}" title="Activate">✅</button>
            <button class="btn btn-ghost btn-sm" data-action="hard-delete" data-id="${s.id}" title="Permanently Delete">❌</button>
            `}
          </div>
        </td>
      </tr>`).join('');
    } catch (err) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--accent-rose);">Error loading suppliers</td></tr>';
    }
  }

  async function loadLedger() {
    try {
      const ledger = await window.api.suppliers.getLedger();
      if (ledger && ledger.success) {
        document.getElementById('ledger-itc').textContent = formatRupees(ledger.itcPaise);
      }
    } catch (e) {
      console.error('Failed to load ledger', e);
    }
  }

  function openSupplierModal(supplier = null) {
    try {
      document.getElementById('modal-supplier-title').textContent = supplier ? '✏️ Edit Supplier' : '🏢 Add Supplier';
      document.getElementById('supplier-edit-id').value = supplier ? supplier.id : '';
      document.getElementById('sup-name').value = supplier ? supplier.name : '';
      document.getElementById('sup-contact').value = supplier ? (supplier.contact_person || '') : '';
      document.getElementById('sup-mobile').value = supplier ? (supplier.mobile || '') : '';
      document.getElementById('sup-email').value = supplier ? (supplier.email || '') : '';
      document.getElementById('sup-gstin').value = supplier ? (supplier.gst_number || '') : '';
      document.getElementById('sup-address').value = supplier ? (supplier.address || '') : '';
      document.getElementById('sup-state').value = supplier ? (supplier.state || '') : '';
      openModal('modal-supplier');
    } catch (e) {
      alert("Error in openSupplierModal: " + e.message + "\n" + e.stack);
    }
  }

  async function saveSupplier() {
    const editId = document.getElementById('supplier-edit-id').value;
    const data = {
      name: document.getElementById('sup-name').value.trim(),
      contactPerson: document.getElementById('sup-contact').value.trim(),
      mobile: document.getElementById('sup-mobile').value.trim(),
      email: document.getElementById('sup-email').value.trim(),
      gstNumber: document.getElementById('sup-gstin').value.trim(),
      address: document.getElementById('sup-address').value.trim(),
      state: document.getElementById('sup-state').value.trim()
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
        loadLedger();
        showToast(editId ? 'Supplier updated' : 'Supplier added', 'success');
      } else {
        showToast(result.error || 'Save failed', 'error');
      }
    } catch (err) {
      showToast('Save error', 'error');
    }
  }

  async function editSupplier(id) {
    const supplier = loadedSuppliers.find(s => s.id === id);
    if (supplier) openSupplierModal(supplier);
  }

  async function deleteSupplier(id) {
    if (!confirm('Deactivate this supplier?')) return;
    const result = await window.api.suppliers.delete(id);
    if (result.success) { loadSuppliers(); showToast('Supplier removed', 'success'); }
    else showToast(result.error || 'Delete failed', 'error');
  }

  async function restoreSupplier(id) {
    if (!confirm('Reactivate this supplier?')) return;
    const result = await window.api.suppliers.restore(id);
    if (result.success) { loadSuppliers(); showToast('Supplier activated', 'success'); }
    else showToast(result.error || 'Activation failed', 'error');
  }

  async function hardDeleteSupplier(id) {
    if (!confirm('Are you SURE you want to PERMANENTLY delete this supplier? This action cannot be undone.')) return;
    const result = await window.api.suppliers.hardDelete(id);
    if (result.success) { loadSuppliers(); showToast('Supplier permanently deleted', 'success'); }
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
        <th>Invoice #</th><th>Status</th><th>Total</th><th>GST Paid</th><th>Items</th><th>Date</th>
      </tr></thead><tbody>` + purchases.map(p => `
        <tr style="cursor:pointer; transition: background 0.2s;" onmouseover="this.style.background='var(--bg-alt)'" onmouseout="this.style.background=''" onclick="SuppliersModule.viewPurchaseDetails(${p.id}, '${name.replace(/'/g, "\\'").replace(/"/g, "&quot;")}', '${(p.invoice_number || '').replace(/'/g, "\\'").replace(/"/g, "&quot;")}', '${p.created_at}', ${p.total_paise}, '${p.status}')">
        <td class="fw-700 font-mono text-sm">${p.invoice_number || '—'}</td>
        <td><span class="badge ${p.status === 'Draft' ? 'badge-amber' : (p.status === 'Paid' ? 'badge-green' : 'badge-blue')}">${p.status || 'Paid'}</span></td>
        <td class="fw-700 text-teal">${formatRupees(p.total_paise)}</td>
        <td class="text-sm">${formatRupees(p.gst_paid_paise || 0)}</td>
        <td>${p.item_count}</td>
        <td class="text-sm text-muted">${formatDate(p.created_at)}</td>
      </tr>`).join('') + `</tbody></table></div>`;
    }
    openModal('modal-supplier-history');
  }

  async function viewPurchaseDetails(purchaseId, supplierName, invoiceNo, dateStr, totalPaise, status) {
    try {
      const result = await window.api.purchases.getDetails(purchaseId);
      if (!result.success) {
        showToast('Failed to load purchase details', 'error');
        return;
      }
      
      document.getElementById('pd-invoice-no').textContent = invoiceNo || '—';
      document.getElementById('pd-date').textContent = formatDate(dateStr);
      document.getElementById('pd-supplier').textContent = supplierName;
      document.getElementById('pd-status').textContent = status;
      
      const roundOffPaise = result.purchase.round_off_paise || 0;
      document.getElementById('pd-round-off').textContent = formatRupees(roundOffPaise);
      
      document.getElementById('pd-total').textContent = formatRupees(totalPaise);
      
      const viewAttachBtn = document.getElementById('pd-view-attachment');
      if (result.purchase && result.purchase.attachment_path) {
        viewAttachBtn.style.display = 'block';
        viewAttachBtn.onclick = async () => {
          const res = await window.api.app.openExternal(result.purchase.attachment_path);
          if (!res.success) showToast(res.error || 'Failed to open file', 'error');
        };
      } else {
        viewAttachBtn.style.display = 'none';
        viewAttachBtn.onclick = null;
      }
      
      const resumeBtn = document.getElementById('pd-resume-draft');
      const deleteBtn = document.getElementById('pd-delete-purchase');
      
      if (deleteBtn) {
        deleteBtn.style.display = 'block';
        deleteBtn.onclick = async () => {
          if (confirm('Are you sure you want to delete this purchase? This will remove the items from stock and reverse the ITC.')) {
            const res = await window.api.purchases.delete(purchaseId);
            if (res.success) {
              showToast('Purchase deleted successfully', 'success');
              closeModal('modal-purchase-details');
              // Refresh history by triggering click again
              const supplierId = result.purchase.supplier_id;
              document.querySelector(`button[data-action="history"][data-id="${supplierId}"]`)?.click();
            } else {
              showToast(res.error || 'Failed to delete purchase', 'error');
            }
          }
        };
      }

      if (status === 'Draft') {
        resumeBtn.style.display = 'block';
        resumeBtn.onclick = () => {
          closeModal('modal-purchase-details');
          closeModal('modal-supplier-history');
          resumePurchaseDraft(purchaseId, supplierName, invoiceNo, result.purchase, result.items);
        };
      } else {
        resumeBtn.style.display = 'none';
        resumeBtn.onclick = null;
      }
      
      const tbody = document.getElementById('pd-items-tbody');
      if (result.items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--text-muted);padding:15px;">No items found</td></tr>';
      } else {
        tbody.innerHTML = result.items.map(item => {
          const hsnOrBatch = [item.hsn_code, item.batch_number].filter(Boolean).join('<br><span class="text-muted" style="font-size:10px;">Batch: ') + (item.batch_number ? '</span>' : '');
          
          return `
            <tr>
              <td class="fw-700">
                ${item.product_name}
                ${item.category_name ? `<br><span class="text-muted" style="font-size:10px;">${item.category_name}</span>` : ''}
              </td>
              <td class="font-mono text-sm">${hsnOrBatch || '—'}</td>
              <td class="fw-700" style="text-align:right;">${item.quantity}</td>
              <td class="text-muted" style="text-align:right;">${item.free_quantity || 0}</td>
              <td class="text-sm" style="text-align:right;">${formatRupees(item.base_cost_paise || 0)}</td>
              <td class="text-sm" style="text-align:right;">${formatRupees(item.scheme_discount_paise || 0)}</td>
              <td class="fw-700" style="text-align:right; display:none;">${formatRupees(item.unit_cost_paise)}</td>
              <td class="text-sm text-teal" style="text-align:right;">${formatRupees(item.selling_price_paise || 0)}</td>
              <td class="text-sm" style="text-align:right;">${item.cgst_percent}% / ${item.sgst_percent}%</td>
              <td class="fw-700 text-teal" style="text-align:right;">${formatRupees(item.line_total_paise)}</td>
            </tr>
          `;
        }).join('');
      }
      
      openModal('modal-purchase-details');
    } catch (err) {
      console.error(err);
      showToast('Error loading details', 'error');
    }
  }
  window.viewPurchaseDetails = viewPurchaseDetails;

  // ─── Add Purchase Logic ──────────────────────────────────────────────────
  let pendingPurchaseItems = [];

  function clearItemFields() {
    document.getElementById('pi-barcode').value = '';
    document.getElementById('pi-name').value = '';
    document.getElementById('pi-hsn').value = '';
    document.getElementById('pi-batch').value = '';
    document.getElementById('pi-expiry').value = '';
    document.getElementById('pi-qty').value = '1';
    document.getElementById('pi-free-qty').value = '0';
    document.getElementById('pi-base-price').value = '';
    document.getElementById('pi-scheme-disc').value = '';
    document.getElementById('pi-purchase-price').value = '';
    document.getElementById('pi-selling-price').value = '';
    document.getElementById('pi-cgst').value = '0';
    document.getElementById('pi-sgst').value = '0';
  }

  async function openAddPurchase(supplierId, supplierName, supplierGstin) {
    try {
      document.getElementById('purchase-supplier-id').value = supplierId;
      document.getElementById('purchase-draft-id').value = '';
      document.getElementById('purchase-supplier-name').value = supplierName;
      document.getElementById('purchase-invoice-number').value = '';
      document.getElementById('purchase-supplier-gstin').value = supplierGstin || '';
      document.getElementById('purchase-invoice-date').value = new Date().toISOString().split('T')[0];
      document.getElementById('purchase-continuous-scan').checked = false;
      document.getElementById('purchase-round-off').value = '0.00';
      const gstInput = document.getElementById('purchase-summary-gst');
      gstInput.value = '0.00';
      delete gstInput.dataset.edited;
      delete document.getElementById('purchase-grand-total').dataset.edited;
      
      clearItemFields();
      pendingPurchaseItems = [];
      updatePurchaseTotal();
      
      // Load categories
      try {
        const cats = await window.api.categories.getAll();
        const catSelect = document.getElementById('pi-category');
        catSelect.innerHTML = '<option value="">— Select —</option>' +
          cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
      } catch (e) {
        console.error(e);
      }
      
      openModal('modal-add-purchase');
      setTimeout(() => {
        const invField = document.getElementById('purchase-invoice-number');
        if (invField) invField.focus();
        // Re-render Lucide icons inside modal
        if (typeof lucide !== 'undefined') lucide.createIcons({ node: document.getElementById('modal-add-purchase') });
      }, 350);
    } catch (err) {
      alert("Error opening modal: " + err.message + "\n" + err.stack);
    }
  }

  async function resumePurchaseDraft(purchaseId, supplierName, invoiceNo, purchaseObj, itemsArray) {
    try {
      document.getElementById('purchase-supplier-id').value = purchaseObj.supplier_id;
      document.getElementById('purchase-draft-id').value = purchaseId;
      document.getElementById('purchase-supplier-name').value = supplierName;
      document.getElementById('purchase-invoice-number').value = invoiceNo || '';
      document.getElementById('purchase-supplier-gstin').value = purchaseObj.supplier_gstin || '';
      document.getElementById('purchase-invoice-date').value = purchaseObj.purchase_date ? purchaseObj.purchase_date.split(' ')[0] : new Date().toISOString().split('T')[0];
      document.getElementById('purchase-continuous-scan').checked = false;
      document.getElementById('purchase-round-off').value = (purchaseObj.round_off_paise ? (purchaseObj.round_off_paise / 100).toFixed(2) : '0.00');
      
      const gstInput = document.getElementById('purchase-summary-gst');
      gstInput.value = (purchaseObj.gst_paid_paise ? (purchaseObj.gst_paid_paise / 100).toFixed(2) : '0.00');
      gstInput.dataset.edited = 'true'; // Keep the saved value explicitly

      const totalInput = document.getElementById('purchase-grand-total');
      totalInput.value = (purchaseObj.total_paise ? (purchaseObj.total_paise / 100).toFixed(2) : '0.00');
      totalInput.dataset.edited = 'true'; // Keep the saved value explicitly
      
      clearItemFields();
      
      pendingPurchaseItems = itemsArray.map(item => ({
        barcode: item.barcode || '',
        productName: item.product_name,
        categoryId: item.category_id || '',
        quantity: item.quantity,
        freeQuantity: item.free_quantity || 0,
        basePricePaise: item.base_cost_paise || 0,
        schemeDiscountPaise: item.scheme_discount_paise || 0,
        purchasePricePaise: item.unit_cost_paise,
        sellingPricePaise: item.selling_price_paise,
        cgstPercent: item.cgst_percent,
        sgstPercent: item.sgst_percent,
        hsnCode: item.hsn_code || ''
      }));
      
      updatePurchaseTotal();
      
      try {
        const cats = await window.api.categories.getAll();
        const catSelect = document.getElementById('pi-category');
        catSelect.innerHTML = '<option value="">— Select —</option>' +
          cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
      } catch (e) {
        console.error(e);
      }
      
      openModal('modal-add-purchase');
      setTimeout(() => {
        const invField = document.getElementById('purchase-invoice-number');
        if (invField) invField.focus();
        if (typeof lucide !== 'undefined') lucide.createIcons({ node: document.getElementById('modal-add-purchase') });
      }, 350);
    } catch (err) {
      alert("Error resuming draft: " + err.message + "\n" + err.stack);
    }
  }



  document.getElementById('btn-pi-lookup').addEventListener('click', async () => {
    const barcode = document.getElementById('pi-barcode').value.trim();
    if (!barcode) return;
    try {
      const product = await window.api.products.lookupBarcode(barcode);
      if (product) {
        document.getElementById('pi-name').value = product.product_name;
        document.getElementById('pi-hsn').value = product.hsn_code || '';
        document.getElementById('pi-category').value = product.category_id || '';
        document.getElementById('pi-selling-price').value = (product.selling_price_paise / 100).toFixed(2);
        document.getElementById('pi-base-price').value = (product.base_price_paise / 100).toFixed(2);
        const qty = parseInt(document.getElementById('pi-qty').value) || 1;
        document.getElementById('pi-scheme-disc').value = ((product.scheme_discount_paise / 100) * qty).toFixed(2);
        document.getElementById('pi-purchase-price').value = ((product.purchase_price_paise / 100) * qty).toFixed(2);
        
        if (product.gst_percent !== undefined && product.gst_percent !== null) {
          const halfGst = product.gst_percent / 2;
          document.getElementById('pi-cgst').value = halfGst.toString();
          document.getElementById('pi-sgst').value = halfGst.toString();
        }
        
        showToast('Product details loaded', 'success');
        
        if (document.getElementById('purchase-continuous-scan').checked) {
          addPurchaseItemSubmit(product.purchase_price_paise);
        }
      } else {
        showToast('Product not found. Fill details to create.', 'info');
      }
    } catch (err) {
      console.error(err);
    }
  });

  document.getElementById('pi-barcode').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('btn-pi-lookup').click();
    }
  });

  function addPurchaseItemSubmit(historicalPurchasePricePaise = null) {
    const barcode = document.getElementById('pi-barcode').value.trim();
    const name = document.getElementById('pi-name').value.trim();
    const hsn = document.getElementById('pi-hsn').value.trim();
    const batchNumber = document.getElementById('pi-batch').value.trim();
    const expiryDate = document.getElementById('pi-expiry').value;
    const categoryId = document.getElementById('pi-category').value;
    const qty = parseInt(document.getElementById('pi-qty').value) || 0;
    const freeQty = parseInt(document.getElementById('pi-free-qty').value) || 0;
    const basePrice = parseFloat(document.getElementById('pi-base-price').value) || 0;
    
    let schemeDisc = 0;
    const schemeDiscRaw = document.getElementById('pi-scheme-disc').value.trim();
    if (schemeDiscRaw.endsWith('%')) {
      const percent = parseFloat(schemeDiscRaw.replace('%', '')) || 0;
      schemeDisc = basePrice * (percent / 100);
    } else {
      schemeDisc = parseFloat(schemeDiscRaw) || 0;
    }
    
    const finalPurchase = parseFloat(document.getElementById('pi-purchase-price').value) || 0;
    const purchasePrice = basePrice;
    const sellingPrice = parseFloat(document.getElementById('pi-selling-price').value) || 0;
    const cgst = parseFloat(document.getElementById('pi-cgst').value) || 0;
    const sgst = parseFloat(document.getElementById('pi-sgst').value) || 0;

    if (!barcode || !name || qty <= 0 || finalPurchase < 0 || sellingPrice <= 0) {
      showToast('Please fill all required fields correctly', 'warning');
      return;
    }

    if (purchasePrice > sellingPrice) {
      alert(`WARNING: Base price (₹${purchasePrice}) is higher than Selling price (₹${sellingPrice})! You might be selling at a loss.`);
    }

    const purchasePricePaise = Math.round(purchasePrice * 100);
    if (historicalPurchasePricePaise && historicalPurchasePricePaise > 0) {
      const diff = Math.abs(purchasePricePaise - historicalPurchasePricePaise);
      if (diff / historicalPurchasePricePaise > 0.1) {
        alert('WARNING: Purchase price fluctuated by > 10% from historical average!');
      }
    }

    const existingIdx = pendingPurchaseItems.findIndex(i => i.barcode === barcode);
    if (existingIdx > -1 && document.getElementById('purchase-continuous-scan').checked) {
      pendingPurchaseItems[existingIdx].quantity += qty;
      pendingPurchaseItems[existingIdx].freeQuantity += freeQty;
    } else {
      pendingPurchaseItems.push({
        barcode,
        productName: name,
        hsnCode: hsn,
        batchNumber: batchNumber,
        expiryDate: expiryDate,
        categoryId: categoryId ? parseInt(categoryId) : null,
        quantity: qty,
        freeQuantity: freeQty,
        basePricePaise: Math.round(basePrice * 100),
        schemeDiscountPaise: Math.round(schemeDisc * 100),
        purchasePricePaise: purchasePricePaise,
        explicitLineTotalPaise: Math.round(finalPurchase * 100),
        sellingPricePaise: Math.round(sellingPrice * 100),
        cgstPercent: cgst,
        sgstPercent: sgst
      });
    }

    clearItemFields();
    updatePurchaseTotal();
    document.getElementById('pi-barcode').focus();
  }

  function removePurchaseItem(index) {
    pendingPurchaseItems.splice(index, 1);
    updatePurchaseTotal();
  }
  
  // Make global for inline HTML onclick handlers
  window.removePurchaseItem = removePurchaseItem;

  function updatePurchaseItemField(index, field, value) {
    if (field === 'quantity') {
      pendingPurchaseItems[index].quantity = parseInt(value) || 0;
    } else if (field === 'freeQuantity') {
      pendingPurchaseItems[index].freeQuantity = parseInt(value) || 0;
    } else if (field === 'purchasePricePaise') {
      const newUnitPaise = Math.round((parseFloat(value) || 0) * 100);
      pendingPurchaseItems[index].purchasePricePaise = newUnitPaise;
      pendingPurchaseItems[index].basePricePaise = newUnitPaise;
      pendingPurchaseItems[index].schemeDiscountPaise = 0;
      pendingPurchaseItems[index].explicitLineTotalPaise = undefined;
      pendingPurchaseItems[index].explicitLineGrandTotalPaise = undefined;
    } else if (field === 'basePricePaise') {
      const newUnitPaise = Math.round((parseFloat(value) || 0) * 100);
      pendingPurchaseItems[index].basePricePaise = newUnitPaise;
      // Do not reset explicitLineTotalPaise!
    } else if (field === 'explicitLineTotalPaise') {
      pendingPurchaseItems[index].explicitLineTotalPaise = Math.round((parseFloat(value) || 0) * 100);
    } else if (field === 'explicitLineGrandTotalPaise') {
      pendingPurchaseItems[index].explicitLineGrandTotalPaise = Math.round((parseFloat(value) || 0) * 100);
    } else if (field === 'cgstPercent') {
      pendingPurchaseItems[index].cgstPercent = parseFloat(value) || 0;
      pendingPurchaseItems[index].explicitLineGrandTotalPaise = undefined;
    } else if (field === 'sgstPercent') {
      pendingPurchaseItems[index].sgstPercent = parseFloat(value) || 0;
      pendingPurchaseItems[index].explicitLineGrandTotalPaise = undefined;
    }
    updatePurchaseTotal();
  }
  window.updatePurchaseItemField = updatePurchaseItemField;

  function updatePurchaseTotal() {
    const tbody = document.getElementById('purchase-items-tbody');
    let totalItems = 0;

    tbody.innerHTML = pendingPurchaseItems.map((item, idx) => {
      let baseVal = item.basePricePaise || 0;
      let totalVal = item.explicitLineTotalPaise !== undefined ? item.explicitLineTotalPaise : baseVal;
      
      totalItems += item.quantity;

      return `<tr>
        <td class="font-mono text-sm">${item.barcode}</td>
        <td class="fw-700">${item.productName}</td>
        <td class="text-sm">${item.hsnCode || '—'}
          ${item.batchNumber ? `<br><span class="text-muted" style="font-size:10px;">Batch: ${item.batchNumber}</span>` : ''}
          ${item.expiryDate ? `<br><span class="text-muted" style="font-size:10px;">Exp: ${item.expiryDate}</span>` : ''}
        </td>
        <td class="fw-700">
          <input type="number" min="1" style="width: 50px; padding: 2px 4px; border: 1px solid var(--border); border-radius: var(--radius-sm);" value="${item.quantity}" onchange="updatePurchaseItemField(${idx}, 'quantity', this.value)">
        </td>
        <td class="text-sm text-muted">
          <input type="number" min="0" style="width: 50px; padding: 2px 4px; border: 1px solid var(--border); border-radius: var(--radius-sm);" value="${item.freeQuantity || 0}" onchange="updatePurchaseItemField(${idx}, 'freeQuantity', this.value)">
        </td>
        <td class="text-sm">
          ₹<input type="number" min="0" step="0.01" style="width: 70px; padding: 2px 4px; border: 1px solid var(--border); border-radius: var(--radius-sm);" value="${(baseVal / 100).toFixed(2)}" onchange="updatePurchaseItemField(${idx}, 'basePricePaise', this.value)">
        </td>
        <td class="text-sm">
          <input type="number" min="0" step="0.1" style="width: 45px; padding: 2px 4px; border: 1px solid var(--border); border-radius: var(--radius-sm);" value="${item.cgstPercent}" onchange="updatePurchaseItemField(${idx}, 'cgstPercent', this.value)">% / 
          <input type="number" min="0" step="0.1" style="width: 45px; padding: 2px 4px; border: 1px solid var(--border); border-radius: var(--radius-sm);" value="${item.sgstPercent}" onchange="updatePurchaseItemField(${idx}, 'sgstPercent', this.value)">%
        </td>
        <td class="fw-700 text-teal">
          ₹<input type="number" min="0" step="0.01" style="width: 80px; padding: 2px 4px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-weight: bold; color: var(--accent-teal);" value="${(totalVal / 100).toFixed(2)}" onchange="updatePurchaseItemField(${idx}, 'explicitLineTotalPaise', this.value)">
        </td>
        <td><button type="button" class="btn btn-ghost btn-sm" onclick="removePurchaseItem(${idx})" style="padding:4px;color:var(--accent-rose);">✕</button></td>
      </tr>`;
    }).join('');

    if (pendingPurchaseItems.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--text-muted);">No items added yet. Click "+ Add Product" to begin.</td></tr>`;
    }

    let sumOfItemTotalsPaise = 0;
    pendingPurchaseItems.forEach(item => {
      let val = item.explicitLineTotalPaise !== undefined ? item.explicitLineTotalPaise : (item.basePricePaise || 0);
      sumOfItemTotalsPaise += val;
    });

    const gstInput = document.getElementById('purchase-summary-gst');
    let explicitGstVal = parseFloat(gstInput.value);
    if (isNaN(explicitGstVal)) explicitGstVal = 0;
    const finalGstPaise = Math.round(explicitGstVal * 100);

    const roundOffVal = parseFloat(document.getElementById('purchase-round-off').value) || 0;
    const roundOffPaise = Math.round(roundOffVal * 100);

    const finalInvoiceTotalPaise = sumOfItemTotalsPaise + finalGstPaise + roundOffPaise;

    const totalInput = document.getElementById('purchase-grand-total');
    totalInput.value = (finalInvoiceTotalPaise / 100).toFixed(2);

    document.getElementById('purchase-summary-items').textContent = totalItems;
  }

  async function savePurchase(isDraft = false) {
    const supplierId = parseInt(document.getElementById('purchase-supplier-id').value);
    const invoiceNumber = document.getElementById('purchase-invoice-number').value.trim();
    const supplierGstin = document.getElementById('purchase-supplier-gstin').value.trim();
    const notes = '';
    
    const invoiceDate = document.getElementById('purchase-invoice-date').value;
    const status = isDraft ? 'Draft' : 'Paid';

    if (pendingPurchaseItems.length === 0) { showToast('Please add at least one product', 'warning'); return; }

    const btn = document.getElementById('btn-save-purchase');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    const explicitGstVal = parseFloat(document.getElementById('purchase-summary-gst').value) || 0;
    let totalGstPaidPaise = Math.round(explicitGstVal * 100);

    const draftIdStr = document.getElementById('purchase-draft-id').value;
    const draftId = draftIdStr ? parseInt(draftIdStr) : null;

    try {
      const roundOffVal = parseFloat(document.getElementById('purchase-round-off').value) || 0;
      const roundOffPaise = Math.round(roundOffVal * 100);
      
      const explicitTotalVal = parseFloat(document.getElementById('purchase-grand-total').value) || 0;
      const explicitTotalPaise = Math.round(explicitTotalVal * 100);

      const result = await window.api.purchases.add({
        supplierId,
        supplierGstin,
        invoiceNumber,
        items: pendingPurchaseItems,
        notes,
        gstPaidPaise: totalGstPaidPaise,
        roundOffPaise: roundOffPaise,
        explicitTotalPaise: explicitTotalPaise,
        status,
        amountPaidPaise: 0,
        dueDate: invoiceDate,
        purchaseDate: invoiceDate,
        attachmentPath: '',
        draftId
      });

      if (result.success) {
        document.getElementById('purchase-draft-id').value = '';
        showToast(isDraft ? 'Purchase saved as Draft!' : 'Purchase and products saved successfully!', 'success');
        closeModal('modal-add-purchase');
        loadLedger();
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
    addPurchaseItemSubmit,
    viewPurchaseDetails
  };
})();
