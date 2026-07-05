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
        lucide.createIcons();
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
        lucide.createIcons();
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
          <button class="btn btn-ghost btn-sm" onclick="CustomersModule.openWhatsAppUpdate('${phone}', '${name.replace(/'/g, "\\'")}')" title="Send WhatsApp Update">
            <i data-lucide="message-circle"></i> Message
          </button>
        </td>
      </tr>
    `}).join('');
    lucide.createIcons();
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
          <tr>
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

  return { init, viewHistory, openWhatsAppUpdate };
})();

// For global access (e.g. from onclick attributes)
window.CustomersModule = CustomersModule;
