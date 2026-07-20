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
        <button class="tab-btn active" data-tab="sales">📊 GSTR-1</button>
        <button class="tab-btn" data-tab="hsn">📝 HSN Summary</button>
        <button class="tab-btn" data-tab="reconciliation">📊 Sale Report</button>
        <button class="tab-btn" data-tab="inventory">📦 Inventory</button>
        <button class="tab-btn" data-tab="purchases">🛍️ Purchases</button>
        <button class="tab-btn" data-tab="services">🛠️ Services</button>
        <button class="tab-btn" data-tab="profit">📈 Profit</button>
      </div>

      <!-- GST Returns Report -->
      <div class="tab-pane active" id="rpt-tab-sales">
        <div class="report-filters">
          <div class="form-group">
            <label class="form-label">From</label>
            <input type="date" class="form-input" id="rpt-gstr1-from" value="${monthStart}">
          </div>
          <div class="form-group">
            <label class="form-label">To</label>
            <input type="date" class="form-input" id="rpt-gstr1-to" value="${today}">
          </div>
          <button class="btn btn-primary btn-sm" id="rpt-gstr1-run">Generate Dashboard</button>
          <button class="btn btn-secondary btn-sm" id="rpt-gstr1-export" disabled>📥 Export Offline CSVs</button>
        </div>
        <div id="rpt-gstr1-summary" class="report-summary mt-16"></div>
        <div id="rpt-gstr1-content"></div>
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
          <button class="btn btn-secondary btn-sm" id="rpt-purch-export">📥 Export CSV</button>
        </div>
        <div id="rpt-purch-content"></div>
      </div>

      <!-- Services Report -->
      <div class="tab-pane" id="rpt-tab-services">
        <div class="report-filters">
          <div class="form-group">
            <label class="form-label">From</label>
            <input type="date" class="form-input" id="rpt-services-from" value="${monthStart}">
          </div>
          <div class="form-group">
            <label class="form-label">To</label>
            <input type="date" class="form-input" id="rpt-services-to" value="${today}">
          </div>
          <button class="btn btn-primary btn-sm" id="rpt-services-run">Generate</button>
          <button class="btn btn-secondary btn-sm" id="rpt-services-export">📥 Export CSV</button>
        </div>
        <div id="rpt-services-summary" class="report-summary mt-16"></div>
        <div id="rpt-services-content"></div>
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

      <!-- HSN Summary Report -->
      <div class="tab-pane" id="rpt-tab-hsn">
        <div class="report-filters">
          <div class="form-group">
            <label class="form-label">From</label>
            <input type="date" class="form-input" id="rpt-hsn-from" value="${monthStart}">
          </div>
          <div class="form-group">
            <label class="form-label">To</label>
            <input type="date" class="form-input" id="rpt-hsn-to" value="${today}">
          </div>
          <button class="btn btn-primary btn-sm" id="rpt-hsn-run">Generate</button>
          <button class="btn btn-secondary btn-sm" id="rpt-hsn-export">📥 Export CSV</button>
        </div>
        <div id="rpt-hsn-content"></div>
      </div>

      <!-- Reconciliation Report -->
      <div class="tab-pane" id="rpt-tab-reconciliation">
        <div class="report-filters">
          <div class="form-group">
            <label class="form-label">From</label>
            <input type="date" class="form-input" id="rpt-recon-from" value="${monthStart}">
          </div>
          <div class="form-group">
            <label class="form-label">To</label>
            <input type="date" class="form-input" id="rpt-recon-to" value="${today}">
          </div>
          <button class="btn btn-primary btn-sm" id="rpt-recon-run">Generate</button>
          <button class="btn btn-secondary btn-sm" id="rpt-recon-export">📥 Export CSV</button>
        </div>
        <div id="rpt-recon-content"></div>
      </div>
    `;
  }

  function bindEvents() {
    // Tab switching
    panel.addEventListener('click', (e) => {
      const tabBtn = e.target.closest('.tab-btn');
      if (tabBtn) { activeTab = tabBtn.dataset.tab; switchTab(activeTab); }
    });

    // GSTR-1 report
    document.getElementById('rpt-gstr1-run').addEventListener('click', runGstr1Report);
    document.getElementById('rpt-gstr1-export').addEventListener('click', exportGstr1CSVs);

    // HSN report
    document.getElementById('rpt-hsn-run').addEventListener('click', runHsnReport);
    document.getElementById('rpt-hsn-export').addEventListener('click', exportHsnCSV);

    // Reconciliation report
    document.getElementById('rpt-recon-run').addEventListener('click', runReconciliationReport);
    document.getElementById('rpt-recon-export').addEventListener('click', exportReconciliationCSV);

    // Inventory report
    document.getElementById('rpt-inv-run').addEventListener('click', runInventoryReport);
    document.getElementById('rpt-inv-export').addEventListener('click', exportInventoryCSV);

    // Purchase report
    document.getElementById('rpt-purch-run').addEventListener('click', runPurchaseReport);
    document.getElementById('rpt-purch-export').addEventListener('click', exportPurchaseCSV);

    // Services report
    document.getElementById('rpt-services-run').addEventListener('click', runServicesReport);
    document.getElementById('rpt-services-export').addEventListener('click', exportServicesCSV);

    // Profit report
    document.getElementById('rpt-profit-run').addEventListener('click', runProfitReport);
  }

  function switchTab(tab) {
    panel.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    panel.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.getElementById('rpt-tab-' + tab)?.classList.add('active');
  }

  // ─── GSTR-1 Report ─────────────────────────────────────────────────────
  let lastGstrData = null;

  async function runGstr1Report() {
    const from = document.getElementById('rpt-gstr1-from').value;
    const to = document.getElementById('rpt-gstr1-to').value;
    if (!from || !to) { showToast('Select date range', 'warning'); return; }

    try {
      const data = await window.api.reports.gstr1({ startDate: from, endDate: to });
      lastGstrData = data;
      document.getElementById('rpt-gstr1-export').disabled = false;

      let b2bTaxable = 0, b2bGst = 0, b2bTotal = 0;
      data.b2b.forEach(r => {
        b2bTaxable += r.subtotal_paise;
        b2bGst += r.cgst_paise + r.sgst_paise + r.igst_paise;
        b2bTotal += r.grand_total_paise;
      });

      let b2clTaxable = 0, b2clGst = 0, b2clTotal = 0;
      data.b2cLarge.forEach(r => {
        b2clTaxable += r.subtotal_paise;
        b2clGst += r.igst_paise;
        b2clTotal += r.grand_total_paise;
      });

      let b2csTaxable = 0, b2csGst = 0, b2csTotal = 0;
      data.b2cSmall.forEach(r => {
        b2csTaxable += r.taxable_value;
        const gst = r.cgst + r.sgst + r.igst;
        b2csGst += gst;
        b2csTotal += r.taxable_value + gst;
      });

      let notesTotal = 0;
      data.creditNotes.forEach(r => notesTotal += r.grand_total_paise);

      document.getElementById('rpt-gstr1-summary').innerHTML = `
        <div class="summary-card" style="display:flex; flex-direction:column; gap:8px;">
          <span class="sc-label">B2B (Table 4)</span>
          <div style="display:flex; justify-content:space-between; font-size:12px;"><span>Base:</span> <span>${formatRupees(b2bTaxable)}</span></div>
          <div style="display:flex; justify-content:space-between; font-size:12px;"><span>GST:</span> <span>${formatRupees(b2bGst)}</span></div>
          <div style="display:flex; justify-content:space-between; font-size:14px; font-weight:bold; border-top:1px solid #eee; padding-top:4px;"><span>Total:</span> <span class="text-teal">${formatRupees(b2bTotal)}</span></div>
        </div>
        <div class="summary-card" style="display:flex; flex-direction:column; gap:8px;">
          <span class="sc-label">B2C Large (Table 5)</span>
          <div style="display:flex; justify-content:space-between; font-size:12px;"><span>Base:</span> <span>${formatRupees(b2clTaxable)}</span></div>
          <div style="display:flex; justify-content:space-between; font-size:12px;"><span>GST:</span> <span>${formatRupees(b2clGst)}</span></div>
          <div style="display:flex; justify-content:space-between; font-size:14px; font-weight:bold; border-top:1px solid #eee; padding-top:4px;"><span>Total:</span> <span class="text-blue">${formatRupees(b2clTotal)}</span></div>
        </div>
        <div class="summary-card" style="display:flex; flex-direction:column; gap:8px;">
          <span class="sc-label">B2C Small (Table 7)</span>
          <div style="display:flex; justify-content:space-between; font-size:12px;"><span>Base:</span> <span>${formatRupees(b2csTaxable)}</span></div>
          <div style="display:flex; justify-content:space-between; font-size:12px;"><span>GST:</span> <span>${formatRupees(b2csGst)}</span></div>
          <div style="display:flex; justify-content:space-between; font-size:14px; font-weight:bold; border-top:1px solid #eee; padding-top:4px;"><span>Total:</span> <span class="text-green">${formatRupees(b2csTotal)}</span></div>
        </div>
      `;

      document.getElementById('rpt-gstr1-content').innerHTML = '';
    } catch (err) {
      console.error('[Reports] gstr1 error:', err);
      showToast('Error generating report: ' + (err.message || ''), 'error');
    }
  }

  function exportGstr1CSVs() {
    if (!lastGstrData) return;
    
    // Table 4 (B2B)
    let b2bCsv = 'GSTIN/UIN of Recipient,Receiver Name,Invoice Number,Invoice date,Invoice Value,Place Of Supply,Reverse Charge,Applicable % of Tax Rate,Invoice Type,E-Commerce GSTIN,Rate,Taxable Value,Cess Amount\n';
    lastGstrData.b2b.forEach(r => {
      const pos = r.customer_state_code || (r.customer_gstin ? r.customer_gstin.substring(0, 2) : '97');
      const rate = r.subtotal_paise > 0 ? (((r.cgst_paise+r.sgst_paise+r.igst_paise) / r.subtotal_paise) * 100).toFixed(2) : 0;
      b2bCsv += `"${r.customer_gstin}","${r.customer_name}","${r.receipt_number}","${formatDateShort(r.created_at)}",${r.grand_total_paise/100},"${pos}","N","","Regular","",${rate},${r.subtotal_paise/100},0\n`;
    });
    if (lastGstrData.b2b.length > 0) downloadCSV(b2bCsv, 'b2b.csv');

    // Table 5 (B2C Large)
    let b2clCsv = 'Invoice Number,Invoice date,Invoice Value,Place Of Supply,Applicable % of Tax Rate,Rate,Taxable Value,Cess Amount,E-Commerce GSTIN\n';
    lastGstrData.b2cLarge.forEach(r => {
      const rate = r.subtotal_paise > 0 ? ((r.igst_paise / r.subtotal_paise) * 100).toFixed(2) : 0;
      const pos = r.customer_state_code || '97';
      b2clCsv += `"${r.receipt_number}","${formatDateShort(r.created_at)}",${r.grand_total_paise/100},"${pos}","",${rate},${r.subtotal_paise/100},0,""\n`;
    });
    if (lastGstrData.b2cLarge.length > 0) downloadCSV(b2clCsv, 'b2cl.csv');

    // Table 7 (B2C Small)
    let b2csCsv = 'Type,Place Of Supply,Applicable % of Tax Rate,Rate,Taxable Value,Cess Amount,E-Commerce GSTIN\n';
    lastGstrData.b2cSmall.forEach(r => {
      const pos = r.place_of_supply || (r.is_inter_state ? '97' : 'local');
      b2csCsv += `"OE","${pos}","",${r.gst_percent},${r.taxable_value/100},0,""\n`;
    });
    if (lastGstrData.b2cSmall.length > 0) downloadCSV(b2csCsv, 'b2cs.csv');

    // Table 9B (Credit Notes)
    let cdnrCsv = 'GSTIN/UIN of Recipient,Receiver Name,Note Number,Note Date,Note Type,Place Of Supply,Reverse Charge,Note Supply Type,Note Value,Applicable % of Tax Rate,Rate,Taxable Value,Cess Amount\n';
    lastGstrData.creditNotes.forEach(r => {
      if (r.is_b2b) {
        const pos = r.customer_gstin ? r.customer_gstin.substring(0, 2) : '97';
        const rate = r.subtotal_paise > 0 ? (((r.cgst_paise+r.sgst_paise+r.igst_paise) / r.subtotal_paise) * 100).toFixed(2) : 0;
        cdnrCsv += `"${r.customer_gstin}","${r.customer_name}","${r.receipt_number}","${formatDateShort(r.created_at)}","C","${pos}","N","Regular",${r.grand_total_paise/100},"",${rate},${r.subtotal_paise/100},0\n`;
      }
    });
    if (lastGstrData.creditNotes.filter(r => r.is_b2b).length > 0) downloadCSV(cdnrCsv, 'cdnr.csv');

    // Table 13 (Docs)
    let docsCsv = 'Nature of Document,Sr. No. From,Sr. No. To,Total Number,Cancelled,Net Issued\n';
    const d = lastGstrData.docs;
    if (d && d.total_count > 0) {
      docsCsv += `"Invoices for outward supply","${d.start_num}","${d.end_num}",${d.total_count},${d.cancelled_count},${d.net_count}\n`;
    }
    const dr = lastGstrData.docsReturn;
    if (dr && dr.total_count > 0) {
      docsCsv += `"Credit Note","${dr.start_num}","${dr.end_num}",${dr.total_count},${dr.cancelled_count},${dr.net_count}\n`;
    }
    downloadCSV(docsCsv, 'docs.csv');
    
    showToast('Multiple CSV files exported', 'success');
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
      const cols = row.querySelectorAll('td');
      if (cols.length < 6) return;
      const r = Array.from(cols).map(c => `"${c.innerText.replace(/"/g, '""')}"`);
      csv += r.join(',') + '\n';
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
      let totalItc = 0;
      purchases.forEach(p => { 
        total += p.total_paise; 
        totalItc += (p.gst_paid_paise || 0);
      });

      content.innerHTML = `
        <div class="report-summary mt-12 mb-16">
          <div class="summary-card"><span class="sc-value text-teal">${purchases.length}</span><span class="sc-label">Purchases</span></div>
          <div class="summary-card"><span class="sc-value text-rose">${formatRupees(total)}</span><span class="sc-label">Total Cost</span></div>
          <div class="summary-card"><span class="sc-value text-blue">${formatRupees(totalItc)}</span><span class="sc-label">Total ITC</span></div>
        </div>
        <div class="card" style="padding:0;"><div class="data-table-wrap" style="max-height:400px;"><table class="data-table" id="rpt-purch-table"><thead><tr>
          <th>Invoice #</th><th>Supplier</th><th>Total</th><th>GST Paid</th><th>Date</th>
        </tr></thead><tbody>${purchases.map(p => `<tr>
          <td class="fw-700 font-mono text-sm">${p.invoice_number || '—'}</td>
          <td>${p.supplier_name || '—'}</td>
          <td class="fw-700 text-rose">${formatRupees(p.total_paise)}</td>
          <td class="text-sm">${formatRupees(p.gst_paid_paise || 0)}</td>
          <td class="text-sm text-muted">${formatDate(p.purchase_date || p.created_at)}</td>
        </tr>`).join('')}</tbody></table></div></div>`;
    } catch (err) {
      console.error('[Reports] purchase error:', err);
    }
  }

  function exportPurchaseCSV() {
    const table = document.getElementById('rpt-purch-table');
    if (!table) { showToast('Generate report first', 'warning'); return; }
    let csv = 'Invoice,Supplier,Total,GST Paid,Date\n';
    table.querySelectorAll('tbody tr').forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 5) {
        csv += Array.from(cells).map(c => `"${c.textContent.trim()}"`).join(',') + '\n';
      }
    });
    downloadCSV(csv, `purchases-${getToday()}.csv`);
  }

  // ─── Services Report ──────────────────────────────────────────────────
  async function runServicesReport() {
    const from = document.getElementById('rpt-services-from').value;
    const to = document.getElementById('rpt-services-to').value;
    if (!from || !to) { showToast('Select date range', 'warning'); return; }

    try {
      const { summary, sales } = await window.api.reports.services({ startDate: from, endDate: to });
      const content = document.getElementById('rpt-services-content');
      
      if (!sales || sales.length === 0) {
        document.getElementById('rpt-services-summary').innerHTML = '';
        content.innerHTML = '<p class="text-muted mt-16" style="text-align:center;">No services billed in this period</p>';
        return;
      }

      document.getElementById('rpt-services-summary').innerHTML = `
        <div class="summary-card"><span class="sc-value text-teal">${summary.total_sales}</span><span class="sc-label">Service Bills</span></div>
        <div class="summary-card"><span class="sc-value text-green">${formatRupees(summary.total_grand)}</span><span class="sc-label">Revenue</span></div>
        <div class="summary-card"><span class="sc-value text-blue">${formatRupees(summary.total_cgst + summary.total_sgst + summary.total_igst)}</span><span class="sc-label">Total GST</span></div>
      `;

      content.innerHTML = `
        <div class="card" style="padding:0;"><div class="data-table-wrap" style="max-height:400px;"><table class="data-table" id="rpt-services-table"><thead><tr>
          <th>Receipt #</th><th>Cashier</th><th>Items</th><th>Base Amount</th><th>GST</th><th>Total</th><th>Date</th>
        </tr></thead><tbody>${sales.map(s => {
          const gst = s.cgst_paise + s.sgst_paise + s.igst_paise;
          return `<tr>
          <td class="fw-700 font-mono text-sm">${s.receipt_number || '—'}</td>
          <td>${s.cashier_name || '—'}</td>
          <td class="fw-700">${s.item_count}</td>
          <td class="text-sm">${formatRupees(s.subtotal_paise)}</td>
          <td class="text-sm">${formatRupees(gst)}</td>
          <td class="fw-700 text-green">${formatRupees(s.grand_total_paise)}</td>
          <td class="text-sm text-muted">${formatDate(s.created_at)}</td>
        </tr>`}).join('')}</tbody></table></div></div>`;
    } catch (err) {
      console.error('[Reports] services error:', err);
    }
  }

  function exportServicesCSV() {
    const rows = document.querySelectorAll('#rpt-services-table tbody tr');
    if (rows.length === 0 || (rows.length === 1 && rows[0].innerText.includes('No services'))) {
      showToast('No data to export', 'warning');
      return;
    }
    let csv = 'Receipt #,Cashier,Items,Base Amount,GST,Total,Date\n';
    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 7) {
        csv += Array.from(cells).map(c => `"${c.textContent.trim()}"`).join(',') + '\n';
      }
    });
    downloadCSV(csv, `services-report-${getToday()}.csv`);
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

  // ─── HSN Summary Report ────────────────────────────────────────────────
  async function runHsnReport() {
    const from = document.getElementById('rpt-hsn-from').value;
    const to = document.getElementById('rpt-hsn-to').value;
    if (!from || !to) { showToast('Select date range', 'warning'); return; }

    try {
      const summary = await window.api.reports.hsnSummary({ startDate: from, endDate: to });
      const content = document.getElementById('rpt-hsn-content');
      if (!summary || summary.length === 0) {
        content.innerHTML = '<p class="text-muted mt-16" style="text-align:center;">No data in this period</p>';
        return;
      }

      content.innerHTML = `<div class="card mt-16" style="padding:0;"><div class="data-table-wrap" style="max-height:400px;"><table class="data-table" id="rpt-hsn-table"><thead><tr>
        <th>HSN Code</th><th>Description</th><th>Qty</th><th>Taxable Value</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Total GST</th>
      </tr></thead><tbody>${summary.map(s => `<tr>
        <td class="font-mono fw-700 text-sm">${s.hsn_code}</td>
        <td class="text-sm">${s.description || '—'}</td>
        <td class="fw-700">${s.total_quantity}</td>
        <td>${formatRupees(s.total_taxable_value)}</td>
        <td class="text-sm">${formatRupees(s.total_cgst)}</td>
        <td class="text-sm">${formatRupees(s.total_sgst)}</td>
        <td class="text-sm">${formatRupees(s.total_igst)}</td>
        <td class="fw-700 text-blue">${formatRupees(s.total_gst)}</td>
      </tr>`).join('')}</tbody></table></div></div>`;
    } catch (err) {
      console.error('[Reports] HSN summary error:', err);
    }
  }

  function exportHsnCSV() {
    const table = document.getElementById('rpt-hsn-table');
    if (!table) { showToast('Generate report first', 'warning'); return; }
    let csv = 'HSN Code,Description,Qty,Taxable Value,CGST,SGST,IGST,Total GST\n';
    table.querySelectorAll('tbody tr').forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 8) {
        csv += Array.from(cells).map(c => `"${c.textContent.trim()}"`).join(',') + '\n';
      }
    });
    downloadCSV(csv, `hsn-summary-${getToday()}.csv`);
  }

  // ─── Daily Reconciliation Report ────────────────────────────────────────
  async function runReconciliationReport() {
    const from = document.getElementById('rpt-recon-from').value;
    const to = document.getElementById('rpt-recon-to').value;
    if (!from || !to) { showToast('Select date range', 'warning'); return; }

    try {
      const { summary, sales } = await window.api.reports.reconciliation({ startDate: from, endDate: to });
      const content = document.getElementById('rpt-recon-content');
      if (!summary || summary.length === 0) {
        content.innerHTML = '<p class="text-muted mt-16" style="text-align:center;">No transactions on this date</p>';
        return;
      }

      let totalCount = 0;
      let totalAmount = 0;

      const rows = summary.map(r => {
        totalCount += r.transaction_count;
        totalAmount += r.total_amount;
        const payBadge = { cash:'badge-green', upi:'badge-violet', card:'badge-blue' }[r.payment_mode] || 'badge-teal';
        return `<tr>
          <td><span class="badge ${payBadge}">${(r.payment_mode||'cash').toUpperCase()}</span></td>
          <td class="fw-700">${r.transaction_count}</td>
          <td class="fw-700 text-green">${formatRupees(r.total_amount)}</td>
        </tr>`;
      }).join('');

      let html = `<div class="card mt-16" style="padding:0;"><div class="data-table-wrap"><table class="data-table" id="rpt-recon-table"><thead><tr>
        <th>Payment Mode</th><th>Transaction Count</th><th>Total Amount</th>
      </tr></thead><tbody>
        ${rows}
        <tr style="background:#f8fafc;">
          <td class="fw-800">GRAND TO
          TAL</td>
          <td class="fw-800">${totalCount}</td>
          <td class="fw-800 text-green">${formatRupees(totalAmount)}</td>
        </tr>
      </tbody></table></div></div>`;

      if (sales && sales.length > 0) {
        const salesRows = sales.map(s => {
          let regStatus = '<span class="badge badge-amber" style="font-size:10px;">Unregistered (Walk-in)</span>';
          if (s.is_b2b) {
             regStatus = '<span class="badge badge-blue" style="font-size:10px;">Registered (B2B)</span>';
          } else if (s.customer_phone || s.customer_name) {
             regStatus = '<span class="badge badge-teal" style="font-size:10px;">Registered Customer</span>';
          }
          
          let customerStr = s.customer_name || 'Walk-in';
          if (s.customer_phone) customerStr += `<br><small class="text-muted" style="font-size:11px;">${s.customer_phone}</small>`;

          const timeStr = new Date(s.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
          const payBadge = { cash:'badge-green', upi:'badge-violet', card:'badge-blue' }[s.payment_mode] || 'badge-teal';

          return `<tr style="cursor:pointer;" onclick="CustomersModule.viewReceiptPreview(${s.id})" title="Click to view detailed receipt">
            <td class="fw-700 font-mono text-sm">${s.receipt_number}</td>
            <td class="text-sm text-muted">${timeStr}</td>
            <td>${customerStr}</td>
            <td>${regStatus}</td>
            <td><span class="badge ${payBadge}" style="font-size:10px;">${(s.payment_mode||'CASH').toUpperCase()}</span></td>
            <td class="fw-700 text-green">${formatRupees(s.grand_total_paise)}</td>
            <td style="text-align:right;">
              ${s.is_return ? '' : `<button class="btn btn-ghost btn-sm btn-delete-sale text-rose" title="Delete Receipt" style="padding:4px; margin:0;" onclick="window.deleteReconSale(event, ${s.id})">🗑️</button>`}
            </td>
          </tr>`;
        }).join('');

        html += `
          <h3 class="mt-24 mb-12" style="font-size:14px; font-weight:600;">Detailed Transactions</h3>
          <div class="card" style="padding:0;"><div class="data-table-wrap" style="max-height:500px; overflow-y:auto;">
            <table class="data-table" id="rpt-recon-details-table"><thead><tr>
              <th>Receipt No</th><th>Time</th><th>Customer</th><th>Status</th><th>Mode</th><th>Amount</th><th style="width:40px;"></th>
            </tr></thead><tbody>
              ${salesRows}
            </tbody></table>
          </div></div>
        `;
      }

      content.innerHTML = html;
    } catch (err) {
      console.error('[Reports] Recon error:', err);
    }
  }

  function exportReconciliationCSV() {
    const table = document.getElementById('rpt-recon-table');
    if (!table) { showToast('Generate report first', 'warning'); return; }
    let csv = 'Payment Mode,Transaction Count,Total Amount\n';
    table.querySelectorAll('tbody tr').forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 3) {
        csv += Array.from(cells).map(c => `"${c.textContent.trim()}"`).join(',') + '\n';
      }
    });
    downloadCSV(csv, `daily-reconciliation-${getToday()}.csv`);
  }

  function downloadCSV(csv, filename) {
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    showToast('CSV exported', 'success');
  }

  async function deleteSale(event, id) {
    event.stopPropagation();
    if (confirm('Are you sure you want to completely delete this sale? This action will restore product inventory and adjust the daily totals.')) {
      try {
        const res = await window.api.billing.deleteSale(id);
        if (res.success) {
          showToast('Sale deleted and stock restored', 'success');
          runReconciliationReport(); // Refresh the report
        } else {
          showToast(res.error || 'Failed to delete sale', 'error');
        }
      } catch (err) {
        showToast('Error deleting sale', 'error');
      }
    }
  }

  return { init, deleteSale };
})();

window.deleteReconSale = ReportsModule.deleteSale;

