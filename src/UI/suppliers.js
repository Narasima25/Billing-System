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
          <label style="font-size:13px; display:flex; align-items:center; gap:5px; cursor:pointer;">
            <input type="checkbox" id="show-inactive-suppliers"> Show Deactivated
          </label>
          <button class="btn btn-primary" id="btn-add-supplier">+ Add Supplier</button>
        </div>
      </div>

      <div class="report-summary mt-8 mb-12" id="supplier-ledger-summary">
        <div class="summary-card"><span class="sc-value text-teal" id="ledger-itc">₹0.00</span><span class="sc-label">Total Tax Claims (ITC)</span></div>
        <div class="summary-card"><span class="sc-value text-rose" id="ledger-dues">₹0.00</span><span class="sc-label">Total Outstanding Dues</span></div>
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

    document.getElementById('btn-save-purchase-item').addEventListener('click', () => addPurchaseItemSubmit());
    document.getElementById('btn-save-purchase').addEventListener('click', () => savePurchase(false));
    document.getElementById('btn-draft-purchase').addEventListener('click', () => savePurchase(true));
    document.getElementById('form-add-purchase').addEventListener('submit', (e) => { e.preventDefault(); savePurchase(false); });

    const calcFinalPurchasePrice = () => {
      const base = parseFloat(document.getElementById('pi-base-price').value) || 0;
      const disc = parseFloat(document.getElementById('pi-scheme-disc').value) || 0;
      const finalPrice = Math.max(0, base - disc);
      document.getElementById('pi-purchase-price').value = finalPrice.toFixed(2);
    };
    document.getElementById('pi-base-price').addEventListener('input', calcFinalPurchasePrice);
    document.getElementById('pi-scheme-disc').addEventListener('input', calcFinalPurchasePrice);
  }

  async function loadSuppliers() {
    const tbody = document.getElementById('suppliers-tbody');
    const includeInactive = document.getElementById('show-inactive-suppliers')?.checked || false;
    try {
      const suppliers = await window.api.suppliers.getAll({ includeInactive });
      if (suppliers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted);">No suppliers yet</td></tr>';
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
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--accent-rose);">Error loading suppliers</td></tr>';
    }
  }

  async function loadLedger() {
    try {
      const ledger = await window.api.suppliers.getLedger();
      if (ledger && ledger.success) {
        document.getElementById('ledger-itc').textContent = formatRupees(ledger.itcPaise);
        document.getElementById('ledger-dues').textContent = formatRupees(ledger.duesPaise);
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
        <th>Invoice #</th><th>Total</th><th>GST Paid</th><th>Items</th><th>Date</th>
      </tr></thead><tbody>${purchases.map(p => `
        <tr style="cursor:pointer; transition: background 0.2s;" onmouseover="this.style.background='var(--bg-alt)'" onmouseout="this.style.background=''" onclick="viewPurchaseDetails(${p.id}, '${name.replace(/'/g, "\\'")}', '${p.invoice_number || ''}', '${p.created_at}', ${p.total_paise}, '${p.status}')">
        <td class="fw-700 font-mono text-sm">${p.invoice_number || '—'}</td>
        <td class="fw-700 text-teal">${formatRupees(p.total_paise)}</td>
        <td class="text-sm">${formatRupees(p.gst_paid_paise || 0)}</td>
        <td>${p.item_count}</td>
        <td class="text-sm text-muted">${formatDate(p.created_at)}</td>
      </tr>`).join('')}</tbody></table></div>`;
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
      document.getElementById('pd-total').textContent = formatRupees(totalPaise);
      
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
              <td class="fw-700" style="text-align:right;">${formatRupees(item.unit_cost_paise)}</td>
              <td class="text-sm text-teal" style="text-align:right;">${formatRupees(item.selling_price_paise || 0)}</td>
              <td class="text-sm" style="text-align:right;">${item.cgst_percent}% / ${item.sgst_percent}%</td>
              <td class="fw-700 text-teal" style="text-align:right;">${formatRupees(item.line_total_paise + Math.round(item.line_total_paise * ((item.cgst_percent + item.sgst_percent) / 100)))}</td>
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
      document.getElementById('purchase-supplier-name').value = supplierName;
      document.getElementById('purchase-invoice-number').value = '';
      document.getElementById('purchase-supplier-gstin').value = supplierGstin || '';
      document.getElementById('purchase-status').value = 'Paid';
      document.getElementById('purchase-amount-paid').value = '';
      document.getElementById('purchase-due-date').value = '';
      document.getElementById('purchase-attachment').value = '';
      document.getElementById('purchase-continuous-scan').checked = false;
      
      // Reset file upload zone
      document.getElementById('upload-empty-state').style.display = '';
      document.getElementById('upload-attached-state').style.display = 'none';
      
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
        if (typeof lucide !== 'undefined') lucide.createIcons();
      }, 350);
    } catch (err) {
      alert("Error opening modal: " + err.message + "\n" + err.stack);
    }
  }

  // ─── File Upload Zone ────────────────────────────────────────────────
  document.getElementById('purchase-upload-zone').addEventListener('click', async (e) => {
    // Don't trigger if clicking the remove button
    if (e.target.closest('#btn-remove-attachment')) return;
    
    try {
      const result = await window.api.dialog.openFile({
        title: 'Select Invoice / Bill Document'
      });
      if (result.success) {
        document.getElementById('purchase-attachment').value = result.filePath;
        document.getElementById('upload-filename').textContent = result.fileName;
        document.getElementById('upload-empty-state').style.display = 'none';
        document.getElementById('upload-attached-state').style.display = '';
        if (typeof lucide !== 'undefined') lucide.createIcons();
        showToast('Document attached: ' + result.fileName, 'success');
      }
    } catch (err) {
      console.error('File picker error:', err);
      showToast('Failed to open file picker', 'error');
    }
  });

  document.getElementById('btn-remove-attachment').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('purchase-attachment').value = '';
    document.getElementById('upload-empty-state').style.display = '';
    document.getElementById('upload-attached-state').style.display = 'none';
    showToast('Attachment removed', 'info');
  });

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
        document.getElementById('pi-scheme-disc').value = (product.scheme_discount_paise / 100).toFixed(2);
        document.getElementById('pi-purchase-price').value = (product.purchase_price_paise / 100).toFixed(2);
        
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
    const categoryId = document.getElementById('pi-category').value;
    const qty = parseInt(document.getElementById('pi-qty').value) || 0;
    const freeQty = parseInt(document.getElementById('pi-free-qty').value) || 0;
    const basePrice = parseFloat(document.getElementById('pi-base-price').value) || 0;
    const schemeDisc = parseFloat(document.getElementById('pi-scheme-disc').value) || 0;
    const purchasePrice = parseFloat(document.getElementById('pi-purchase-price').value) || 0;
    const sellingPrice = parseFloat(document.getElementById('pi-selling-price').value) || 0;
    const cgst = parseFloat(document.getElementById('pi-cgst').value) || 0;
    const sgst = parseFloat(document.getElementById('pi-sgst').value) || 0;

    if (!barcode || !name || qty <= 0 || purchasePrice < 0 || sellingPrice <= 0) {
      showToast('Please fill all required fields correctly', 'warning');
      return;
    }

    if (purchasePrice > sellingPrice) {
      alert(`WARNING: Purchase price (₹${purchasePrice}) is higher than Selling price (₹${sellingPrice})! You are selling at a loss.`);
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
        categoryId: categoryId ? parseInt(categoryId) : null,
        quantity: qty,
        freeQuantity: freeQty,
        basePricePaise: Math.round(basePrice * 100),
        schemeDiscountPaise: Math.round(schemeDisc * 100),
        purchasePricePaise: purchasePricePaise,
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

  function updatePurchaseTotal() {
    const tbody = document.getElementById('purchase-items-tbody');
    let grandTotalPaise = 0;
    let totalGstPaise = 0;
    let totalItems = 0;

    tbody.innerHTML = pendingPurchaseItems.map((item, idx) => {
      const lineTotalPaise = item.quantity * item.purchasePricePaise;
      const gstPercent = item.cgstPercent + item.sgstPercent;
      const lineGstPaise = Math.round(lineTotalPaise * (gstPercent / 100));
      
      grandTotalPaise += lineTotalPaise + lineGstPaise; 
      totalGstPaise += lineGstPaise;
      totalItems += item.quantity;

      return `<tr>
        <td class="font-mono text-sm">${item.barcode}</td>
        <td class="fw-700">${item.productName}</td>
        <td class="text-sm">${item.hsnCode || '—'}</td>
        <td class="fw-700">${item.quantity}</td>
        <td class="text-sm text-muted">${item.freeQuantity || 0}</td>
        <td class="text-sm">${formatRupees(item.purchasePricePaise)}</td>
        <td class="text-sm">${item.cgstPercent}% / ${item.sgstPercent}%</td>
        <td class="fw-700 text-teal">${formatRupees(lineTotalPaise + lineGstPaise)}</td>
        <td><button type="button" class="btn btn-ghost btn-sm" onclick="removePurchaseItem(${idx})" style="padding:4px;color:var(--accent-rose);">✕</button></td>
      </tr>`;
    }).join('');

    if (pendingPurchaseItems.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text-muted);">No items added yet. Click "+ Add Product" to begin.</td></tr>`;
    }

    document.getElementById('purchase-summary-items').textContent = totalItems;
    document.getElementById('purchase-summary-gst').textContent = formatRupees(totalGstPaise);
    document.getElementById('purchase-grand-total').textContent = formatRupees(grandTotalPaise);
  }

  async function savePurchase(isDraft = false) {
    const supplierId = parseInt(document.getElementById('purchase-supplier-id').value);
    const invoiceNumber = document.getElementById('purchase-invoice-number').value.trim();
    const supplierGstin = document.getElementById('purchase-supplier-gstin').value.trim();
    const notes = '';
    
    const status = isDraft ? 'Draft' : document.getElementById('purchase-status').value;
    const amountPaid = parseFloat(document.getElementById('purchase-amount-paid').value) || 0;
    const dueDate = document.getElementById('purchase-due-date').value;
    const attachmentPath = document.getElementById('purchase-attachment').value.trim();

    if (!invoiceNumber) { showToast('Invoice number is required', 'warning'); return; }
    if (pendingPurchaseItems.length === 0) { showToast('Please add at least one product', 'warning'); return; }

    const btn = document.getElementById('btn-save-purchase');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    // Calculate total GST paid on the frontend to pass to backend
    let totalGstPaidPaise = 0;
    pendingPurchaseItems.forEach(item => {
      const lineTotalPaise = item.quantity * item.purchasePricePaise;
      const gstPercent = item.cgstPercent + item.sgstPercent;
      totalGstPaidPaise += Math.round(lineTotalPaise * (gstPercent / 100));
    });

    try {
      const result = await window.api.purchases.add({
        supplierId,
        supplierGstin,
        invoiceNumber,
        items: pendingPurchaseItems,
        notes,
        gstPaidPaise: totalGstPaidPaise,
        status,
        amountPaidPaise: Math.round(amountPaid * 100),
        dueDate,
        attachmentPath
      });

      if (result.success) {
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
    addPurchaseItemSubmit
  };
})();
