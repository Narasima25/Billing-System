// ═══════════════════════════════════════════════════════════════════════════
//  UI/reports.js — Reports Module
//  Sales, Inventory, Purchase, and Profit reports with date filters and CSV.
// ═══════════════════════════════════════════════════════════════════════════

const ReportsModule = (() => {
  const panel = document.getElementById('panel-reports');
  let initialized = false;
  let activeTab = 'sales';

  function init() {
    if (!initialized) {
      render();
      bindEvents();
      initialized = true;
    }
    switchTab(activeTab);
  }

  function render() {
    const today = getToday();
    const monthStart = today.substring(0, 8) + '01';

    panel.innerHTML = `
      <div class="section-header">
        <h2>📋 Reports</h2>
        <p>Sales, inventory, purchase, and profit analytics</p>
      </div>

      <div class="tab-bar">
        <button class="tab-btn active" data-tab="sales">💰 Sales</button>
        <button class="tab-btn" data-tab="inventory">📦 Inventory</button>
        <button class="tab-btn" data-tab="purchases">🛍️ Purchases</button>
        <button class="tab-btn" data-tab="profit">📈 Profit</button>
      </div>

      <!-- Sales Report -->
      <div class="tab-pane active" id="rpt-tab-sales">
        <div class="report-filters">
          <div class="form-group">
            <label class="form-label">From</label>
            <input type="date" class="form-input" id="rpt-sales-from" value="${monthStart}">
          </div>
          <div class="form-group">
            <label class="form-label">To</label>
            <input type="date" class="form-input" id="rpt-sales-to" value="${today}">
          </div>
          <div class="form-group">
            <label class="form-label">Payment Mode</label>
            <select class="form-select" id="rpt-sales-payment-mode" style="width:120px;">
              <option value="all">All</option>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
            </select>
          </div>
          <div class="btn-group" style="margin-bottom:0;">
            <button class="btn btn-primary btn-sm" id="rpt-sales-run">Generate</button>
            <button class="btn btn-secondary btn-sm" id="rpt-sales-today" title="Today">Today</button>
            <button class="btn btn-secondary btn-sm" id="rpt-sales-week" title="This week">Week</button>
            <button class="btn btn-secondary btn-sm" id="rpt-sales-month" title="This month">Month</button>
          </div>
        </div>
        <div id="rpt-sales-summary" class="report-summary"></div>
        <div id="rpt-sales-content"></div>
      </div>

      <!-- Inventory Report -->
      <div class="tab-pane" id="rpt-tab-inventory">
        <div class="report-filters">
          <div class="form-group">
            <label class="form-label">Filter</label>
            <select class="form-select" id="rpt-inv-filter" style="width:200px;">
              <option value="all">All Stock</option>
              <option value="low">Low Stock Only</option>
              <option value="out">Out of Stock Only</option>
            </select>
          </div>
          <button class="btn btn-primary btn-sm" id="rpt-inv-run">Generate</button>
          <button class="btn btn-secondary btn-sm" id="rpt-inv-export">📥 Export CSV</button>
        </div>
        <div id="rpt-inv-content"></div>
      </div>

      <!-- Purchase Report -->
      <div class="tab-pane" id="rpt-tab-purchases">
        <div class="report-filters">
          <div class="form-group">
            <label class="form-label">From</label>
            <input type="date" class="form-input" id="rpt-purch-from" value="${monthStart}">
          </div>
          <div class="form-group">
            <label class="form-label">To</label>
            <input type="date" class="form-input" id="rpt-purch-to" value="${today}">
          </div>
          <button class="btn btn-primary btn-sm" id="rpt-purch-run">Generate</button>
        </div>
        <div id="rpt-purch-content"></div>
      </div>

      <!-- Profit Report -->
      <div class="tab-pane" id="rpt-tab-profit">
        <div class="report-filters">
          <div class="form-group">
            <label class="form-label">From</label>
            <input type="date" class="form-input" id="rpt-profit-from" value="${monthStart}">
          </div>
          <div class="form-group">
            <label class="form-label">To</label>
            <input type="date" class="form-input" id="rpt-profit-to" value="${today}">
          </div>
          <button class="btn btn-primary btn-sm" id="rpt-profit-run">Generate</button>
        </div>
        <div id="rpt-profit-content"></div>
      </div>
    `;
  }

  function bindEvents() {
    // Tab switching
    panel.addEventListener('click', (e) => {
      const tabBtn = e.target.closest('.tab-btn');
      if (tabBtn) { activeTab = tabBtn.dataset.tab; switchTab(activeTab); }
    });

    // Sales report
    document.getElementById('rpt-sales-run').addEventListener('click', runSalesReport);
    document.getElementById('rpt-sales-today').addEventListener('click', () => {
      document.getElementById('rpt-sales-from').value = getToday();
      document.getElementById('rpt-sales-to').value = getToday();
      runSalesReport();
    });
    document.getElementById('rpt-sales-week').addEventListener('click', () => {
      const d = new Date(); d.setDate(d.getDate() - d.getDay());
      document.getElementById('rpt-sales-from').value = d.toISOString().split('T')[0];
      document.getElementById('rpt-sales-to').value = getToday();
      runSalesReport();
    });
    document.getElementById('rpt-sales-month').addEventListener('click', () => {
      document.getElementById('rpt-sales-from').value = getToday().substring(0, 8) + '01';
      document.getElementById('rpt-sales-to').value = getToday();
      runSalesReport();
    });

    // Inventory report
    document.getElementById('rpt-inv-run').addEventListener('click', runInventoryReport);
    document.getElementById('rpt-inv-export').addEventListener('click', exportInventoryCSV);

    // Purchase report
    document.getElementById('rpt-purch-run').addEventListener('click', runPurchaseReport);

    // Profit report
    document.getElementById('rpt-profit-run').addEventListener('click', runProfitReport);
  }

  function switchTab(tab) {
    panel.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    panel.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.getElementById('rpt-tab-' + tab)?.classList.add('active');
  }

  // ─── Sales Report ─────────────────────────────────────────────────────
  async function runSalesReport() {
    const from = document.getElementById('rpt-sales-from').value;
    const to = document.getElementById('rpt-sales-to').value;
    const paymentMode = document.getElementById('rpt-sales-payment-mode').value;
    if (!from || !to) { showToast('Select date range', 'warning'); return; }

    try {
      const { sales, summary } = await window.api.reports.sales({ startDate: from, endDate: to, paymentMode });

      // Summary cards
      const summaryDiv = document.getElementById('rpt-sales-summary');
      if (summary) {
        summaryDiv.innerHTML = `
          <div class="summary-card"><span class="sc-value text-teal">${summary.total_sales}</span><span class="sc-label">Total Sales</span></div>
          <div class="summary-card"><span class="sc-value text-green">${formatRupees(summary.total_grand)}</span><span class="sc-label">Revenue</span></div>
          <div class="summary-card"><span class="sc-value text-blue">${formatRupees(summary.total_cgst + summary.total_sgst)}</span><span class="sc-label">GST Collected</span></div>
          <div class="summary-card"><span class="sc-value text-amber">${formatRupees(summary.total_discount)}</span><span class="sc-label">Discounts</span></div>
        `;
      }

      // Table
      const content = document.getElementById('rpt-sales-content');
      if (sales.length === 0) {
        content.innerHTML = '<p class="text-muted mt-16" style="text-align:center;">No sales in this period</p>';
        return;
      }
      content.innerHTML = `<div class="card mt-16" style="padding:0;"><div class="data-table-wrap" style="max-height:400px;"><table class="data-table"><thead><tr>
        <th>Receipt #</th><th>Amount</th><th>GST</th><th>Discount</th><th>Grand Total</th><th>Payment</th><th>Cashier</th><th>Date</th>
      </tr></thead><tbody>${sales.map(s => {
        const payBadge = { cash:'badge-green', upi:'badge-violet', card:'badge-blue' }[s.payment_mode] || 'badge-teal';
        return `<tr>
          <td class="font-mono fw-700 text-sm">${s.receipt_number}</td>
          <td>${formatRupees(s.subtotal_paise)}</td>
          <td class="text-sm">${formatRupees(s.cgst_paise + s.sgst_paise)}</td>
          <td class="text-sm">${s.discount_paise > 0 ? formatRupees(s.discount_paise) : '—'}</td>
          <td class="fw-700 text-green">${formatRupees(s.grand_total_paise)}</td>
          <td><span class="badge ${payBadge}">${(s.payment_mode||'cash').toUpperCase()}</span></td>
          <td class="text-sm">${s.cashier_name || '—'}</td>
          <td class="text-sm text-muted">${formatDate(s.created_at)}</td>
        </tr>`;
      }).join('')}</tbody></table></div></div>`;
    } catch (err) {
      console.error('[Reports] sales error:', err);
    }
  }

  // ─── Inventory Report ─────────────────────────────────────────────────
  async function runInventoryReport() {
    const filter = document.getElementById('rpt-inv-filter').value;
    try {
      const products = await window.api.reports.inventory({ filter });
      const content = document.getElementById('rpt-inv-content');
      if (products.length === 0) {
        content.innerHTML = '<p class="text-muted mt-16" style="text-align:center;">No matching products</p>';
        return;
      }

      let totalValue = 0;
      products.forEach(p => { totalValue += p.selling_price_paise * p.stock_quantity; });

      content.innerHTML = `
        <div class="report-summary mt-12 mb-16">
          <div class="summary-card"><span class="sc-value text-teal">${products.length}</span><span class="sc-label">Products</span></div>
          <div class="summary-card"><span class="sc-value text-green">${formatRupees(totalValue)}</span><span class="sc-label">Stock Value</span></div>
        </div>
        <div class="card" style="padding:0;"><div class="data-table-wrap" style="max-height:400px;"><table class="data-table" id="rpt-inv-table"><thead><tr>
          <th>Product</th><th>Category</th><th>Stock</th><th>Min Level</th><th>Selling ₹</th><th>Value</th>
        </tr></thead><tbody>${products.map(p => {
          let sc = 'ok';
          if (p.stock_quantity === 0) sc = 'critical';
          else if (p.stock_quantity <= p.minimum_stock_level) sc = 'low';
          return `<tr>
            <td class="fw-700">${p.product_name}</td>
            <td class="text-sm">${p.category_name || '—'}</td>
            <td><span class="stock-badge ${sc}">${p.stock_quantity}</span></td>
            <td class="text-sm">${p.minimum_stock_level}</td>
            <td>${formatRupees(p.selling_price_paise)}</td>
            <td class="fw-700">${formatRupees(p.selling_price_paise * p.stock_quantity)}</td>
          </tr>`;
        }).join('')}</tbody></table></div></div>`;
    } catch (err) {
      console.error('[Reports] inventory error:', err);
    }
  }

  function exportInventoryCSV() {
    const table = document.getElementById('rpt-inv-table');
    if (!table) { showToast('Generate report first', 'warning'); return; }
    let csv = 'Product,Category,Stock,Min Level,Selling Price,Value\n';
    table.querySelectorAll('tbody tr').forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 6) {
        csv += Array.from(cells).map(c => `"${c.textContent.trim()}"`).join(',') + '\n';
      }
    });
    downloadCSV(csv, `inventory-report-${getToday()}.csv`);
  }

  // ─── Purchase Report ──────────────────────────────────────────────────
  async function runPurchaseReport() {
    const from = document.getElementById('rpt-purch-from').value;
    const to = document.getElementById('rpt-purch-to').value;
    try {
      const purchases = await window.api.reports.purchases({ startDate: from, endDate: to });
      const content = document.getElementById('rpt-purch-content');
      if (purchases.length === 0) {
        content.innerHTML = '<p class="text-muted mt-16" style="text-align:center;">No purchases in this period</p>';
        return;
      }

      let total = 0;
      purchases.forEach(p => { total += p.total_paise; });

      content.innerHTML = `
        <div class="report-summary mt-12 mb-16">
          <div class="summary-card"><span class="sc-value text-teal">${purchases.length}</span><span class="sc-label">Purchases</span></div>
          <div class="summary-card"><span class="sc-value text-rose">${formatRupees(total)}</span><span class="sc-label">Total Cost</span></div>
        </div>
        <div class="card" style="padding:0;"><div class="data-table-wrap" style="max-height:400px;"><table class="data-table"><thead><tr>
          <th>Invoice #</th><th>Supplier</th><th>Total</th><th>Date</th>
        </tr></thead><tbody>${purchases.map(p => `<tr>
          <td class="fw-700 font-mono text-sm">${p.invoice_number || '—'}</td>
          <td>${p.supplier_name || '—'}</td>
          <td class="fw-700 text-rose">${formatRupees(p.total_paise)}</td>
          <td class="text-sm text-muted">${formatDate(p.created_at)}</td>
        </tr>`).join('')}</tbody></table></div></div>`;
    } catch (err) {
      console.error('[Reports] purchase error:', err);
    }
  }

  // ─── Profit Report ────────────────────────────────────────────────────
  async function runProfitReport() {
    const from = document.getElementById('rpt-profit-from').value;
    const to = document.getElementById('rpt-profit-to').value;
    try {
      const data = await window.api.reports.profit({ startDate: from, endDate: to });
      const content = document.getElementById('rpt-profit-content');
      const isProfit = data.totalProfitPaise >= 0;
      content.innerHTML = `
        <div class="report-summary mt-12">
          <div class="summary-card"><span class="sc-value text-green">${formatRupees(data.totalRevenuePaise)}</span><span class="sc-label">Revenue</span></div>
          <div class="summary-card"><span class="sc-value text-rose">${formatRupees(data.totalCostPaise)}</span><span class="sc-label">Cost</span></div>
          <div class="summary-card"><span class="sc-value ${isProfit ? 'text-green' : 'text-rose'}">${formatRupees(data.totalProfitPaise)}</span><span class="sc-label">${isProfit ? 'Profit' : 'Loss'}</span></div>
          <div class="summary-card"><span class="sc-value ${isProfit ? 'text-teal' : 'text-rose'}">${data.profitPercent}%</span><span class="sc-label">Margin</span></div>
        </div>
        <div class="alert-card ${isProfit ? 'info' : 'danger'} mt-20">
          <span class="alert-icon">${isProfit ? '📈' : '📉'}</span>
          <span class="alert-text">
            ${isProfit ? 'Your store is profitable!' : 'Your store is operating at a loss.'} 
            Net ${isProfit ? 'profit' : 'loss'} of <strong>${formatRupees(Math.abs(data.totalProfitPaise))}</strong> 
            (${data.profitPercent}% margin) across <strong>${data.itemCount}</strong> line items.
          </span>
        </div>`;
    } catch (err) {
      console.error('[Reports] profit error:', err);
    }
  }

  function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    showToast('CSV exported', 'success');
  }

  return { init };
})();
