
// ═══════════════════════════════════════════════════════════════════════════
//  UI/dashboard.js — Dashboard Module
//  Displays sales stats, alerts, expiry tracking, and recent transactions.
// ═══════════════════════════════════════════════════════════════════════════

const DashboardModule = (() => {
  const panel = document.getElementById('panel-dashboard');
  let refreshTimer = null;
  let initialized = false;

  function init() {
    if (!initialized) {
      render();
      initialized = true;
    }
    refresh();
    // Auto-refresh every 30 seconds
    clearInterval(refreshTimer);
    refreshTimer = setInterval(refresh, 30000);
  }

  function render() {
    panel.innerHTML = `
      <div class="section-header">
        <h2><i data-lucide="layout-dashboard"></i> Dashboard Overview</h2>
        <p>Real-time store performance and critical alerts</p>
      </div>

      <!-- Stat Cards -->
      <div class="grid-4 mb-24" id="dash-stats-grid">
        <div class="stat-card teal">
          <span class="stat-icon"><i data-lucide="indian-rupee"></i></span>
          <span class="stat-value text-teal" id="ds-today-sales">₹0.00</span>
          <span class="stat-label">Today's Sales</span>
        </div>
        <div class="stat-card blue">
          <span class="stat-icon"><i data-lucide="calendar"></i></span>
          <span class="stat-value text-blue" id="ds-monthly-sales">₹0.00</span>
          <span class="stat-label">Monthly Sales</span>
        </div>
        <div class="stat-card green">
          <span class="stat-icon"><i data-lucide="trending-up"></i></span>
          <span class="stat-value text-green" id="ds-total-revenue">₹0.00</span>
          <span class="stat-label">Total Revenue</span>
        </div>
        <div class="stat-card orange">
          <span class="stat-icon"><i data-lucide="tags"></i></span>
          <span class="stat-value text-orange" id="ds-total-products">0</span>
          <span class="stat-label">Total Products</span>
        </div>
      </div>

      <div class="grid-3 mb-24">
        <div class="stat-card teal">
          <span class="stat-icon"><i data-lucide="package"></i></span>
          <span class="stat-value" id="ds-total-inventory">0</span>
          <span class="stat-label">Total Inventory</span>
        </div>
        <div class="stat-card amber">
          <span class="stat-icon"><i data-lucide="alert-triangle"></i></span>
          <span class="stat-value text-amber" id="ds-low-stock">0</span>
          <span class="stat-label">Low Stock Alerts</span>
        </div>
        <div class="stat-card rose">
          <span class="stat-icon"><i data-lucide="ban"></i></span>
          <span class="stat-value text-rose" id="ds-out-stock">0</span>
          <span class="stat-label">Out of Stock</span>
        </div>
      </div>

      <!-- Alerts Row -->
      <div id="dash-alerts" class="mb-20"></div>

      <!-- Recent Transactions -->
      <div class="card">
        <div class="card-header">
          <div class="card-icon teal"><i data-lucide="receipt"></i></div>
          <div>
            <h3>Recent Transactions</h3>
            <p>Last 10 sales</p>
          </div>
        </div>
        <div class="data-table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Receipt #</th>
                <th>Amount</th>
                <th>Payment</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody id="dash-sales-body">
              <tr><td colspan="4" style="text-align:center;padding:30px;color:var(--text-muted);">No transactions yet</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
    setTimeout(() => { if (typeof lucide !== 'undefined') lucide.createIcons(); }, 0);
  }

  async function refresh() {
    try {
      const stats = await window.api.dashboard.getStats();

      document.getElementById('ds-today-sales').textContent = formatRupees(stats.todaySalesPaise || 0);
      document.getElementById('ds-monthly-sales').textContent = formatRupees(stats.monthlySalesPaise || 0);
      document.getElementById('ds-total-revenue').textContent = formatRupees(stats.totalRevenuePaise || 0);
      document.getElementById('ds-total-products').textContent = (stats.totalProducts || 0).toLocaleString('en-IN');
      document.getElementById('ds-total-inventory').textContent = (stats.totalInventory || 0).toLocaleString('en-IN');
      document.getElementById('ds-low-stock').textContent = (stats.lowStockCount || 0).toLocaleString('en-IN');
      document.getElementById('ds-out-stock').textContent = (stats.outOfStockCount || 0).toLocaleString('en-IN');

      // Alerts
      const alertsDiv = document.getElementById('dash-alerts');
      let alertsHtml = '';

      if (stats.outOfStockCount > 0) {
        alertsHtml += `<div class="alert-card danger"><span class="alert-icon"><i data-lucide="ban"></i></span><span class="alert-text"><strong>${stats.outOfStockCount}</strong> products are out of stock</span></div>`;
      }
      if (stats.lowStockCount > 0) {
        alertsHtml += `<div class="alert-card warning"><span class="alert-icon"><i data-lucide="alert-triangle"></i></span><span class="alert-text"><strong>${stats.lowStockCount}</strong> products are below minimum stock level</span></div>`;
      }
      if (stats.expired && stats.expired.length > 0) {
        alertsHtml += `<div class="alert-card danger"><span class="alert-icon"><i data-lucide="alert-circle"></i></span><span class="alert-text"><strong>${stats.expired.length}</strong> expiry items have expired</span></div>`;
      }
      if (stats.expiring30 && stats.expiring30.length > 0) {
        alertsHtml += `<div class="alert-card warning"><span class="alert-icon"><i data-lucide="clock"></i></span><span class="alert-text"><strong>${stats.expiring30.length}</strong> expiry items expiring within 30 days</span></div>`;
      }

      alertsDiv.innerHTML = alertsHtml;

      // Recent Sales
      const tbody = document.getElementById('dash-sales-body');
      if (stats.recentSales && stats.recentSales.length > 0) {
        tbody.innerHTML = stats.recentSales.map(sale => {
          const payBadge = {
            cash: 'badge-green', upi: 'badge-violet', card: 'badge-blue'
          }[sale.payment_mode] || 'badge-teal';
          return `<tr>
            <td><span class="font-mono fw-700 text-sm">${sale.receipt_number}</span></td>
            <td><span class="fw-700 text-green">${formatRupees(sale.grand_total_paise)}</span></td>
            <td><span class="badge ${payBadge}">${(sale.payment_mode || 'cash').toUpperCase()}</span></td>
            <td><span class="text-sm text-muted">${formatDate(sale.created_at)}</span></td>
          </tr>`;
        }).join('');
      } else {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:30px;color:var(--text-muted);">No transactions yet</td></tr>';
      }
      setTimeout(() => { if (typeof lucide !== 'undefined') lucide.createIcons(); }, 0);
    } catch (err) {
      console.error('[Dashboard] refresh error:', err);
    }
  }

  return { init, refresh };
})();
