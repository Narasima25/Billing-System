// ═══════════════════════════════════════════════════════════════════════════
//  UI/customers.js — Customers Management Module
//  View customers and their purchase history.
// ═══════════════════════════════════════════════════════════════════════════

const CustomersModule = (() => {
  const panel = document.getElementById('panel-customers');
  let initialized = false;
  let allCustomers = [];
  let selectedCustomers = new Map();

  function init() {
    if (!initialized) {
      render();
      bindEvents();
      initialized = true;
    }
    loadCustomers();
  }

  function render() {
    panel.innerHTML = `
      <div class="page-toolbar">
        <div>
          <h2 style="font-size:20px;font-weight:800;margin-bottom:4px;">👥 Customer Directory</h2>
          <p class="text-muted text-sm">View customers and their purchase histories</p>
        </div>
        <div class="btn-group" style="align-items: center; gap: 16px;">
          <button class="btn btn-primary" id="btn-broadcast-msg"><i data-lucide="megaphone"></i> Broadcast Message</button>
          <div class="search-bar" style="max-width: 300px; margin-bottom: 0;">
            <i data-lucide="search" class="search-icon"></i>
            <input type="text" id="customers-search" class="search-input" placeholder="Search name or phone..." autocomplete="off">
          </div>
        </div>
      </div>

      <div class="card" style="padding:0; margin-top: 20px;">
        <div class="data-table-wrap" style="max-height:calc(100vh - 200px);">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;"><input type="checkbox" id="chk-select-all-customers"></th>
                <th>Phone Number</th>
                <th>Name</th>
                <th>Loyalty Balance</th>
                <th>Lifetime Spent</th>
                <th>Joined Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="customers-tbody">
              <tr><td colspan="7" style="text-align:center;">Loading customers...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
    lucide.createIcons();
  }

  function bindEvents() {
    const searchInput = document.getElementById('customers-search');
    let searchTimer = null;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        const q = e.target.value.toLowerCase();
        const filtered = allCustomers.filter(c => 
          (c.name || '').toLowerCase().includes(q) || 
          (c.phone_number || '').includes(q)
        );
        renderTable(filtered);
      }, 250);
    });

    document.getElementById('btn-send-wa-update').addEventListener('click', async () => {
      const phone = document.getElementById('wa-customer-phone').value;
      const name = document.getElementById('wa-customer-name').value;
      const message = document.getElementById('wa-message-text').value.trim();

      if (!message) {
        showToast('Please enter a message to send.', 'warning');
        return;
      }

      const btn = document.getElementById('btn-send-wa-update');
      btn.disabled = true;
      btn.innerHTML = 'Sending...';

      try {
        const result = await window.api.customers.sendUpdate({ phone, customerName: name, messageText: message });
        if (result.success) {
          showToast('WhatsApp message sent successfully!', 'success');
          closeModal('modal-whatsapp-update');
        } else {
          showToast('Failed to send message: ' + (result.error || 'Unknown error'), 'error');
        }
      } catch (err) {
        console.error(err);
        showToast('Failed to send message.', 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="send"></i> Send Message';
        lucide.createIcons({ node: btn });
      }
    });

    // Select All
    document.getElementById('chk-select-all-customers').addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      const visibleCheckboxes = document.querySelectorAll('.chk-customer-row');
      visibleCheckboxes.forEach(chk => {
        chk.checked = isChecked;
        if (isChecked) {
          selectedCustomers.set(chk.dataset.phone, chk.dataset.name);
        } else {
          selectedCustomers.delete(chk.dataset.phone);
        }
      });
    });

    // Individual Row Select (Delegation)
    document.getElementById('customers-tbody').addEventListener('change', (e) => {
      if (e.target.classList.contains('chk-customer-row')) {
        const phone = e.target.dataset.phone;
        const name = e.target.dataset.name;
        if (e.target.checked) {
          selectedCustomers.set(phone, name);
        } else {
          selectedCustomers.delete(phone);
          document.getElementById('chk-select-all-customers').checked = false;
        }
      }
    });

    // Open Broadcast Modal
    document.getElementById('btn-broadcast-msg').addEventListener('click', () => {
      if (selectedCustomers.size === 0) {
        showToast('Please select at least one customer to broadcast to.', 'warning');
        return;
      }
      document.getElementById('wa-bulk-count').textContent = selectedCustomers.size + ' selected';
      document.getElementById('wa-bulk-message-text').value = '';
      openModal('modal-whatsapp-bulk-update');
    });

    // Send Broadcast
    document.getElementById('btn-send-wa-bulk-update').addEventListener('click', async () => {
      const message = document.getElementById('wa-bulk-message-text').value.trim();
      if (!message) {
        showToast('Please enter a promotional message.', 'warning');
        return;
      }

      const btn = document.getElementById('btn-send-wa-bulk-update');
      btn.disabled = true;
      btn.innerHTML = 'Broadcasting...';

      // Convert map to array of recipients
      const recipients = Array.from(selectedCustomers.entries()).map(([phone, name]) => ({ phone, name }));

      try {
        const result = await window.api.customers.sendBulkUpdate({ recipients, messageText: message });
        if (result.success) {
          showToast('Broadcast sent successfully to ' + recipients.length + ' customers!', 'success');
          closeModal('modal-whatsapp-bulk-update');
          // Clear selection
          selectedCustomers.clear();
          document.getElementById('chk-select-all-customers').checked = false;
          renderTable(allCustomers); // re-render to clear checkboxes
        } else {
          showToast('Failed to broadcast: ' + (result.error || 'Unknown error'), 'error');
        }
      } catch (err) {
        console.error(err);
        showToast('Failed to broadcast message.', 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="send"></i> Send Broadcast';
        lucide.createIcons({ node: btn });
      }
    });
  }

  async function loadCustomers() {
    try {
      allCustomers = await window.api.customers.getAll();
      renderTable(allCustomers);
    } catch (err) {
      console.error('Failed to load customers:', err);
      showToast('Error loading customers', 'error');
    }
  }

  function renderTable(data) {
    const tbody = document.getElementById('customers-tbody');
    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px;">No customers found.</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(c => {
      const phone = c.phone_number;
      const name = c.name || '';
      const isChecked = selectedCustomers.has(phone) ? 'checked' : '';
      return `
      <tr>
        <td style="text-align: center;"><input type="checkbox" class="chk-customer-row" data-phone="${phone}" data-name="${name.replace(/"/g, '&quot;')}" ${isChecked}></td>
        <td style="font-weight:600; font-family:monospace; color:var(--text-primary);">${phone}</td>
        <td>${c.name || '<span class="badge text-muted" style="background:var(--bg-alt);">Unknown</span>'}</td>
        <td style="font-weight:600; color:var(--accent-primary);">${formatRupees(c.coupon_balance_paise)}</td>
        <td>${formatRupees(c.total_lifetime_spent_paise)}</td>
        <td>${formatDateShort(c.created_at)}</td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="CustomersModule.viewHistory('${c.phone_number}')" title="View History">
            <i data-lucide="history"></i> History
          </button>
          <button class="btn btn-ghost btn-sm" onclick="CustomersModule.openWhatsAppUpdate('${phone}', '${name.replace(/'/g, "\\'").replace(/"/g, "&quot;")}')" title="Send WhatsApp Update">
            <i data-lucide="message-circle"></i> Message
          </button>
        </td>
      </tr>
    `}).join('');
    lucide.createIcons({ node: tbody });
  }

  async function viewHistory(phone) {
    try {
      const history = await window.api.customers.getHistory(phone);
      
      const tbody = document.getElementById('ch-items-tbody');
      document.getElementById('ch-phone').textContent = phone;
      document.getElementById('ch-count').textContent = history.length + ' receipts';
      
      if (!history || history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">No purchase history found.</td></tr>';
      } else {
        tbody.innerHTML = history.map(sale => `
          <tr style="cursor:pointer;" onclick="CustomersModule.viewReceiptPreview(${sale.id})" title="Click to view receipt">
            <td style="font-family:monospace; font-weight:600;">${sale.receipt_number}</td>
            <td>${formatDate(sale.created_at)}</td>
            <td style="text-transform:capitalize;">
              <span class="badge" style="background: ${sale.payment_mode === 'cash' ? 'var(--accent-teal)' : sale.payment_mode === 'upi' ? 'var(--accent-violet)' : 'var(--accent-blue)'}; color:white;">
                ${sale.payment_mode}
              </span>
            </td>
            <td>${sale.is_return ? '<span class="badge" style="background:var(--accent-rose);color:white;">Return</span>' : 'Sale'}</td>
            <td style="text-align:right; font-weight:700; ${sale.is_return ? 'color:var(--accent-rose);' : 'color:var(--accent-green);'}">${formatRupees(sale.grand_total_paise)}</td>
          </tr>
        `).join('');
      }

      openModal('modal-customer-history');
    } catch (err) {
      console.error('Failed to load customer history:', err);
      showToast('Error loading customer history', 'error');
    }
  }

  function openWhatsAppUpdate(phone, name) {
    document.getElementById('wa-customer-phone').value = phone;
    document.getElementById('wa-customer-name').value = name;
    document.getElementById('wa-message-text').value = '';
    openModal('modal-whatsapp-update');
  }

  async function viewReceiptPreview(saleId) {
    try {
      const sale = await window.api.billing.getSale(saleId);
      if (!sale) return;

      const settingsArr = await window.api.settings.getAll();
      const settings = {};
      settingsArr.forEach(s => settings[s.key] = s.value);
      const storeName = settings['store_name'] || 'My Store';
      const storePhone = settings['store_phone'] || '';
      const storeAddress = settings['store_address'] || '';

      const itemsHtml = sale.items.map(item => {
        const discountAmount = item.discount_paise || 0;
        let html = `<div class="r-row"><span>${item.product_name}${item.hsn_code ? ` <span style="font-size:10px;">(HSN: ${item.hsn_code})</span>` : ''}</span></div>`;
        html += `<div class="r-row"><span>&nbsp;&nbsp;${item.quantity} x ${formatRupees(item.unit_price_paise)}</span><span>${formatRupees(Math.max(0, item.line_total_paise))}</span></div>`;
        if (item.free_quantity > 0) {
          html += `<div class="r-row"><span>&nbsp;&nbsp;+ ${item.free_quantity} Free</span><span></span></div>`;
        }
        if (discountAmount > 0) {
          html += `<div class="r-row"><span>&nbsp;&nbsp;Discount</span><span>-${formatRupees(discountAmount)}</span></div>`;
        }
        return html;
      }).join('');

      const previewContent = document.getElementById('receipt-preview-content');
      
      let dateStr = formatDate(sale.created_at);

      previewContent.innerHTML = `
        <div class="r-center r-bold" style="font-size:16px;">${storeName}</div>
        ${storePhone ? `<div class="r-center" style="font-size:10px;">Ph: ${storePhone}</div>` : ''}
        <div class="r-line"></div>
        <div class="r-row"><span>Receipt:</span><span>${sale.receipt_number}</span></div>
        <div class="r-row"><span>Date:</span><span>${dateStr}</span></div>
        ${(sale.customer_name || sale.customer_phone) ? `<div class="r-row"><span>Customer:</span><span>${sale.customer_name || sale.customer_phone}</span></div>` : ''}
        <div class="r-line"></div>
        ${itemsHtml}
        <div class="r-line"></div>
        <div class="r-row"><span>Taxable Value</span><span>${formatRupees(sale.subtotal_paise)}</span></div>
        ${sale.is_inter_state ?
          `<div class="r-row"><span>IGST</span><span>${formatRupees(sale.igst_paise)}</span></div>` :
          `<div class="r-row"><span>CGST</span><span>${formatRupees(sale.cgst_paise)}</span></div>
           <div class="r-row"><span>SGST</span><span>${formatRupees(sale.sgst_paise)}</span></div>`
        }
        ${sale.discount_paise > 0 ? `<div class="r-row"><span>Discount</span><span>-${formatRupees(sale.discount_paise)}</span></div>` : ''}
        ${sale.applied_coupon_paise > 0 ? `<div class="r-row"><span>Coupon Applied</span><span>-${formatRupees(sale.applied_coupon_paise)}</span></div>` : ''}
        <div class="r-line"></div>
        <div class="r-row r-total"><span>GRAND TOTAL</span><span>${formatRupees(sale.grand_total_paise)}</span></div>
        <div class="r-line"></div>
        <div class="r-row"><span>Payment:</span><span>${(sale.payment_mode || 'cash').toUpperCase()}</span></div>
        ${sale.reward_earned_paise > 0 ? `
        <div class="r-line"></div>
        <div class="r-center" style="font-weight:bold; margin-top:4px;">🎉 Congratulations! 🎉</div>
        <div class="r-center" style="font-size:11px;">You won a bonus coupon of: ${formatRupees(sale.reward_earned_paise)}</div>
        ` : ''}
        <div class="r-line"></div>
        <div class="r-center" style="margin-top:8px;">Thank You! Visit Again 🐾</div>
        <div class="r-center" style="font-size:10px; margin-top:4px;">${storeAddress}</div>
      `;
      previewContent.parentElement.style.width = '340px'; 
      openModal('modal-receipt-preview');
    } catch (err) {
      console.error('Failed to load receipt:', err);
      showToast('Error loading receipt details', 'error');
    }
  }

  return { init, viewHistory, openWhatsAppUpdate, viewReceiptPreview };
})();

// For global access (e.g. from onclick attributes)
window.CustomersModule = CustomersModule;
