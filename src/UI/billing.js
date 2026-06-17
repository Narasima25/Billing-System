// ═══════════════════════════════════════════════════════════════════════════
//  UI/billing.js — POS Billing Module
//  Full-featured point-of-sale with barcode scanning, cart management,
//  GST calculation, payment modes, customer capture, and receipt printing.
// ═══════════════════════════════════════════════════════════════════════════

const BillingModule = (() => {
  const panel = document.getElementById('panel-billing');
  let initialized = false;
  let cart = [];
  let selectedPaymentMode = 'cash';

  let scanner = null;

  function init() {
    if (!initialized) {
      render();
      bindEvents();
      initialized = true;
    }
    // Focus scanner
    setTimeout(() => { if (scanner) scanner.focus(); }, 100);
  }

  function render() {
    panel.innerHTML = `
      <div class="pos-layout">
        <!-- LEFT: Scanner + Cart Table -->
        <div class="pos-left">
          <!-- Scanner -->
          <div class="card" style="padding:16px;">
            <div class="scanner-input-wrap mb-12">
              <span class="scan-icon"><i data-lucide="barcode"></i></span>
              <input type="text" class="scanner-input" id="billing-scanner"
                placeholder="Scan barcode to add item..." autocomplete="off" autofocus>
            </div>
            
            <div class="customer-search-wrap" style="margin: 0 0 12px 0;">
              <input type="text" id="billing-manual-search" placeholder="Or search product by name..." autocomplete="off" style="padding: 10px 14px; font-size: 13px; border: 1px solid var(--border); border-radius: var(--radius-sm); width: 100%; background: var(--bg-input); color: var(--text-primary); outline: none;">
              <div class="customer-results" id="billing-manual-results" style="max-height: 250px; overflow-y: auto;"></div>
            </div>

            <div class="scanner-status">
              <span class="scanner-dot"></span>
              Scanner ready — Scan barcode or press F2 for new sale
            </div>
            <div id="billing-flash"></div>
          </div>

          <!-- Cart Table -->
          <div class="card flex-1" style="overflow:hidden; display:flex; flex-direction:column; padding:0;">
            <div style="padding:16px 20px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
              <h3 style="font-size:15px; font-weight:700;"><i data-lucide="shopping-cart"></i> Cart Items</h3>
              <span class="text-sm text-muted" id="billing-cart-count">0 items</span>
            </div>
            <div style="flex:1; overflow-y:auto;" id="billing-cart-area">
              <div class="cart-empty" id="billing-cart-empty">
                <span class="empty-icon"><i data-lucide="shopping-bag"></i></span>
                <p>Cart is empty<br>Scan items to start billing</p>
              </div>
              <div id="billing-cart-items"></div>
            </div>
          </div>
        </div>

        <!-- RIGHT: Checkout Panel -->
        <div class="pos-right">
          <div class="pos-right-header">
            <h3><i data-lucide="credit-card"></i> Checkout</h3>
          </div>
          <div style="flex:1; overflow-y:auto; padding:16px 20px;">


            <!-- Totals -->
            <div id="billing-totals" class="mt-12">
              <div class="checkout-row">
                <span class="label">Subtotal</span>
                <span class="value" id="billing-subtotal">₹0.00</span>
              </div>
              <div class="checkout-row">
                <span class="label">CGST</span>
                <span class="value" id="billing-cgst">₹0.00</span>
              </div>
              <div class="checkout-row">
                <span class="label">SGST</span>
                <span class="value" id="billing-sgst">₹0.00</span>
              </div>
              <div class="discount-input-wrap">
                <label>Discount (₹)</label>
                <input type="number" id="billing-discount" value="0" min="0" step="0.01">
              </div>
              <div class="checkout-row total">
                <span class="label">Grand Total</span>
                <span class="value" id="billing-grand-total">₹0.00</span>
              </div>
            </div>

            <!-- Payment Mode -->
            <div class="payment-modes">
              <button class="payment-mode-btn active" data-mode="cash" id="pm-cash">
                <span class="pm-icon"><i data-lucide="banknote"></i></span> Cash
              </button>
              <button class="payment-mode-btn" data-mode="upi" id="pm-upi">
                <span class="pm-icon"><i data-lucide="smartphone"></i></span> UPI
              </button>
              <button class="payment-mode-btn" data-mode="card" id="pm-card">
                <span class="pm-icon"><i data-lucide="credit-card"></i></span> Card
              </button>
            </div>
          </div>

          <!-- Actions -->
          <div class="pos-checkout-panel">
            <div class="checkout-actions">
              <button class="btn btn-danger" id="billing-clear-btn">✕ Clear</button>
              <button class="btn btn-primary btn-lg" id="billing-checkout-btn" style="flex:2;">
                ✓ Complete Sale (F8)
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    scanner = document.getElementById('billing-scanner');
  }

  function bindEvents() {
    // Global Scanner Buffer (Optimized for Mobile/3rd Party Scanner Apps)
    let scanBuffer = '';
    let scanTimer = null;

    document.addEventListener('keydown', async (e) => {
      if (!panel.classList.contains('active') || document.querySelector('.modal-overlay.visible')) return;

      // If user is actively typing in another input (like customer search or manual search), don't intercept
      if (document.activeElement && document.activeElement.tagName === 'INPUT' && document.activeElement !== scanner) {
        scanBuffer = '';
        return;
      }

      if (e.key === 'Enter') {
        let barcode = scanBuffer;
        scanBuffer = '';

        // Fallback: If buffer dropped characters but input is focused, grab from input
        if ((!barcode || barcode.length < 3) && scanner && document.activeElement === scanner) {
          barcode = scanner.value.trim();
        }

        if (barcode && barcode.length >= 3) {
          e.preventDefault();
          if (scanner) scanner.value = '';
          await handleScan(barcode);
        }
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        scanBuffer += e.key;
        clearTimeout(scanTimer);
        // Increased tolerance to 300ms for mobile scanner apps that type slower
        scanTimer = setTimeout(() => { scanBuffer = ''; }, 300);
      }
    });

    // Payment mode buttons
    panel.addEventListener('click', (e) => {
      const pmBtn = e.target.closest('.payment-mode-btn');
      if (pmBtn) {
        panel.querySelectorAll('.payment-mode-btn').forEach(b => b.classList.remove('active'));
        pmBtn.classList.add('active');
        selectedPaymentMode = pmBtn.dataset.mode;
      }
    });

    // Clear cart
    document.getElementById('billing-clear-btn').addEventListener('click', () => {
      if (cart.length === 0) { showToast('Cart is already empty', 'info'); return; }
      cart = [];
      document.getElementById('billing-discount').value = '0';
      updateCartUI();
      showToast('Cart cleared', 'info');
      scanner.focus();
    });

    // Checkout
    document.getElementById('billing-checkout-btn').addEventListener('click', handleCheckout);

    // Discount change
    panel.addEventListener('input', (e) => {
      if (e.target.id === 'billing-discount') updateTotals();
    });



    // Manual Product Search (By Name)
    const manualSearch = document.getElementById('billing-manual-search');
    let manualTimer = null;
    manualSearch.addEventListener('input', () => {
      clearTimeout(manualTimer);
      manualTimer = setTimeout(async () => {
        const q = manualSearch.value.trim();
        const resultsDiv = document.getElementById('billing-manual-results');
        if (q.length < 2) {
          resultsDiv.classList.remove('show');
          return;
        }
        const data = await window.api.products.getAll({ search: q, perPage: 15 });
        const products = data.products.filter(p => p.is_active === 1);
        
        if (products.length === 0) {
          resultsDiv.innerHTML = `<div class="customer-result-item text-muted">No products found</div>`;
        } else {
          resultsDiv.innerHTML = products.map(p => {
            const isOOS = p.stock_quantity <= 0;
            return `<div class="customer-result-item" data-barcode="${p.barcode}" style="display:flex; justify-content:space-between; align-items:center; ${isOOS ? 'opacity:0.6;' : ''}">
               <div>
                 <strong>${p.product_name}</strong> <span class="text-xs text-muted" style="margin-left:4px;">${p.barcode}</span>
                 <div class="text-sm ${isOOS ? 'text-rose' : 'text-green'}" style="margin-top:2px;">Stock: ${p.stock_quantity}</div>
               </div>
               <div class="fw-700">${formatRupees(p.selling_price_paise)}</div>
             </div>`;
          }).join('');
        }
        resultsDiv.classList.add('show');
      }, 300);
    });

    document.getElementById('billing-manual-results').addEventListener('click', async (e) => {
      const item = e.target.closest('.customer-result-item');
      if (!item || !item.dataset.barcode) return;
      
      document.getElementById('billing-manual-results').classList.remove('show');
      manualSearch.value = '';
      
      await handleScan(item.dataset.barcode);
    });

    // Close manual results on click outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#billing-manual-search') && !e.target.closest('#billing-manual-results')) {
        const mr = document.getElementById('billing-manual-results');
        if (mr) mr.classList.remove('show');
      }
    });

    // Cart item events (delegated)
    document.getElementById('billing-cart-items').addEventListener('click', (e) => {
      const idx = parseInt(e.target.closest('[data-index]')?.dataset.index);
      if (isNaN(idx)) return;

      if (e.target.closest('.qty-plus')) {
        // Check stock before increasing
        const item = cart[idx];
        if (item._stockQty && item.quantity >= item._stockQty) {
          showToast(`Maximum stock reached (${item._stockQty})`, 'warning');
          return;
        }
        cart[idx].quantity++;
        updateCartUI();
      } else if (e.target.closest('.qty-minus')) {
        if (cart[idx].quantity > 1) { cart[idx].quantity--; updateCartUI(); }
      } else if (e.target.closest('.ci-remove')) {
        cart.splice(idx, 1);
        updateCartUI();
      }
    });

    document.getElementById('billing-cart-items').addEventListener('input', (e) => {
      if (e.target.classList.contains('ci-price-input')) {
        const idx = parseInt(e.target.closest('[data-index]')?.dataset.index);
        if (isNaN(idx)) return;
        const newPrice = parseFloat(e.target.value);
        if (!isNaN(newPrice) && newPrice >= 0) {
          cart[idx].unitPricePaise = Math.round(newPrice * 100);
          updateTotals();
          
          const lineTotal = cart[idx].unitPricePaise * cart[idx].quantity;
          e.target.closest('.cart-item').querySelector('.ci-total').textContent = formatRupees(lineTotal);
        }
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (!panel.classList.contains('active')) return;
      if (e.target.closest('.modal-overlay')) return;

      if (e.key === 'F2') { e.preventDefault(); newSale(); }
      if (e.key === 'F8') { e.preventDefault(); handleCheckout(); }
    });

    // Focus scanner periodically if not typing elsewhere
    setInterval(() => {
      if (panel.classList.contains('active') && scanner &&
          document.activeElement.tagName !== 'INPUT' &&
          document.activeElement.tagName !== 'SELECT' &&
          document.activeElement.tagName !== 'TEXTAREA') {
        scanner.focus();
      }
    }, 3000);
  }

  async function handleScan(barcode) {
    const flash = document.getElementById('billing-flash');
    flash.innerHTML = '';

    try {
      const product = await window.api.products.lookupBarcode(barcode);
      if (!product) {
        showToast(`Barcode "${barcode}" not found`, 'error');
        return;
      }

      // Check stock
      const existing = cart.find(c => c.barcode === barcode);
      const cartQty = existing ? existing.quantity : 0;

      if (product.stock_quantity <= 0) {
        flash.innerHTML = `<div class="oos-alert">🚫 <strong>${product.product_name}</strong> is <strong>OUT OF STOCK</strong></div>`;
        showToast('OUT OF STOCK — Cannot add to bill', 'warning');
        setTimeout(() => flash.innerHTML = '', 4000);
        return;
      }

      if (cartQty >= product.stock_quantity) {
        flash.innerHTML = `<div class="oos-alert">⚠️ Maximum stock reached for <strong>${product.product_name}</strong> (${product.stock_quantity} available)</div>`;
        showToast('Stock limit reached', 'warning');
        setTimeout(() => flash.innerHTML = '', 4000);
        return;
      }

      // Add to cart
      if (existing) {
        existing.quantity++;
      } else {
        const batches = await window.api.batches.getByProduct(product.id);
        const activeBatches = batches.filter(b => b.quantity > 0);
        const firstBatch = activeBatches.length > 0 ? activeBatches[0] : null;

        cart.push({
          productId: product.id,
          barcode: product.barcode,
          productName: product.product_name,
          unitPricePaise: product.selling_price_paise,
          gstPercent: product.gst_percent || 0,
          quantity: 1,
          _stockQty: product.stock_quantity,
          supplierName: product.supplier_name || 'N/A',
          batchNumber: firstBatch ? firstBatch.batch_number : 'N/A',
          originalCostPaise: firstBatch ? firstBatch.purchase_price_paise : (product.purchase_price_paise || 0),
          hsnCode: product.hsn_code || '',
        });
      }

      updateCartUI();
      showToast(`Added <strong>${product.product_name}</strong>`, 'success');
    } catch (err) {
      console.error('[Billing] scan error:', err);
      showToast('Scan error', 'error');
    }
  }

  function updateCartUI() {
    const cartArea = document.getElementById('billing-cart-items');
    const emptyState = document.getElementById('billing-cart-empty');
    const countSpan = document.getElementById('billing-cart-count');

    if (cart.length === 0) {
      emptyState.style.display = '';
      cartArea.innerHTML = '';
      countSpan.textContent = '0 items';
    } else {
      emptyState.style.display = 'none';
      countSpan.textContent = `${cart.length} item${cart.length > 1 ? 's' : ''}`;
      cartArea.innerHTML = cart.map((item, idx) => {
        const lineTotal = item.unitPricePaise * item.quantity;
        return `
          <div class="cart-item" data-index="${idx}" style="flex-direction: column; align-items: stretch; gap: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="flex: 1;">
                <div class="ci-name">${item.productName}</div>
                <div class="ci-barcode">${item.barcode}</div>
              </div>
              <div class="qty-control" style="margin-right: 12px;">
                <button class="qty-minus" title="Decrease">−</button>
                <span class="qty-val">${item.quantity}</span>
                <button class="qty-plus" title="Increase">+</button>
              </div>
              <div style="display: flex; align-items: center; gap: 4px; margin-right: 12px;">
                <span style="font-size: 13px; font-weight: 600; color: var(--text-muted);">₹</span>
                <input type="number" class="ci-price-input" value="${(item.unitPricePaise / 100).toFixed(2)}" step="0.01" min="0" style="width: 75px; padding: 6px 8px; border: 1px solid var(--border); border-radius: var(--radius-sm); text-align: right; font-weight: 700; background: var(--bg-input); color: var(--text-primary); outline: none;">
              </div>
              <span class="ci-total" style="width: 80px; text-align: right; margin-right: 12px;">${formatRupees(lineTotal)}</span>
              <button class="ci-remove" title="Remove">✕</button>
            </div>
            <div style="font-size: 11px; color: var(--text-muted); display: flex; gap: 16px; border-top: 1px dashed var(--border); padding-top: 6px; margin-top: 2px;">
              <span style="display: flex; align-items: center;"><i data-lucide="truck" style="width:12px;height:12px;margin-right:4px;"></i> ${item.supplierName}</span>
              <span style="display: flex; align-items: center;"><i data-lucide="tag" style="width:12px;height:12px;margin-right:4px;"></i> Cost: ${formatRupees(item.originalCostPaise)}</span>
              <span style="display: flex; align-items: center;"><i data-lucide="layers" style="width:12px;height:12px;margin-right:4px;"></i> Batch: ${item.batchNumber}</span>
            </div>
          </div>`;
      }).join('');
      if (window.lucide) window.lucide.createIcons();
    }

    updateTotals();
  }

  function updateTotals() {
    let subtotal = 0;
    let cgst = 0;
    let sgst = 0;

    cart.forEach(item => {
      const line = item.unitPricePaise * item.quantity;
      subtotal += line;
      if (item.gstPercent > 0) {
        const gst = Math.round(line * item.gstPercent / 100);
        cgst += Math.round(gst / 2);
        sgst += Math.round(gst / 2);
      }
    });

    const discountStr = document.getElementById('billing-discount').value;
    const discountPaise = parseRupeesToPaise(discountStr || '0');
    const grandTotal = subtotal + cgst + sgst - discountPaise;

    document.getElementById('billing-subtotal').textContent = formatRupees(subtotal);
    document.getElementById('billing-cgst').textContent = formatRupees(cgst);
    document.getElementById('billing-sgst').textContent = formatRupees(sgst);
    document.getElementById('billing-grand-total').textContent = formatRupees(Math.max(0, grandTotal));
  }

  async function handleCheckout() {
    if (cart.length === 0) { showToast('Cart is empty — scan items first', 'warning'); return; }

    const discountPaise = parseRupeesToPaise(document.getElementById('billing-discount').value || '0');

    const cartItems = cart.map(item => ({
      productId: item.productId,
      barcode: item.barcode,
      productName: item.productName,
      quantity: item.quantity,
      unitPricePaise: item.unitPricePaise,
      gstPercent: item.gstPercent,
      hsnCode: item.hsnCode,
    }));

    try {
      const result = await window.api.billing.checkout({
        cartItems,
        paymentMode: selectedPaymentMode,
        discountPaise,
        userId: currentUser ? currentUser.id : null,
      });

      if (result.success) {
        // Show confirmation modal
        const confirmDiv = document.getElementById('checkout-confirm-content');
        confirmDiv.innerHTML = `
          <div style="font-size:48px;margin-bottom:12px;">✅</div>
          <div style="font-size:20px;font-weight:800;margin-bottom:8px;">Sale Complete!</div>
          <div class="font-mono fw-700" style="font-size:16px;color:var(--accent-teal);margin-bottom:16px;">${result.receiptNumber}</div>
          <div style="font-size:32px;font-weight:900;color:var(--accent-teal);">${formatRupees(result.grandTotalPaise)}</div>
          <div class="text-muted text-sm mt-8">Payment: ${selectedPaymentMode.toUpperCase()}</div>
        `;

        // Build receipt for printing
        buildReceipt(result, cartItems);

        openModal('modal-checkout-confirm');

        // Reset
        cart = [];
        document.getElementById('billing-discount').value = '0';
        updateCartUI();

        showToast(`Sale ${result.receiptNumber} — ${formatRupees(result.grandTotalPaise)}`, 'success');
      } else {
        showToast('Checkout failed: ' + (result.error || 'Unknown error'), 'error');
      }
    } catch (err) {
      console.error('[Billing] checkout error:', err);
      showToast('Checkout error', 'error');
    }

    scanner.focus();
  }

  function buildReceipt(saleResult, cartItems) {
    const container = document.getElementById('receipt-container');
    const now = new Date();
    const dateStr = formatDate(now.toISOString());

    let itemsHtml = cartItems.map(item => {
      const total = item.unitPricePaise * item.quantity;
      return `<div class="r-row"><span>${item.productName}</span></div>
              <div class="r-row"><span>&nbsp;&nbsp;${item.quantity} x ${formatRupees(item.unitPricePaise)}</span><span>${formatRupees(total)}</span></div>`;
    }).join('');

    container.innerHTML = `
      <div class="r-center r-bold" style="font-size:16px;">PET STORE</div>
      <div class="r-center" style="font-size:10px;">Your Trusted Pet Store</div>
      <div class="r-line"></div>
      <div class="r-row"><span>Receipt:</span><span>${saleResult.receiptNumber}</span></div>
      <div class="r-row"><span>Date:</span><span>${dateStr}</span></div>
      <div class="r-line"></div>
      ${itemsHtml}
      <div class="r-line"></div>
      <div class="r-row"><span>Subtotal</span><span>${formatRupees(saleResult.subtotalPaise)}</span></div>
      <div class="r-row"><span>CGST</span><span>${formatRupees(saleResult.cgstPaise)}</span></div>
      <div class="r-row"><span>SGST</span><span>${formatRupees(saleResult.sgstPaise)}</span></div>
      ${saleResult.discountPaise > 0 ? `<div class="r-row"><span>Discount</span><span>-${formatRupees(saleResult.discountPaise)}</span></div>` : ''}
      <div class="r-line"></div>
      <div class="r-row r-total"><span>GRAND TOTAL</span><span>${formatRupees(saleResult.grandTotalPaise)}</span></div>
      <div class="r-line"></div>
      <div class="r-row"><span>Payment:</span><span>${selectedPaymentMode.toUpperCase()}</span></div>
      <div class="r-line"></div>
      <div class="r-center" style="margin-top:8px;">Thank You! Visit Again 🐾</div>
    `;

    // Print button handler
    document.getElementById('btn-print-receipt').onclick = () => {
      window.print();
    };
  }



  function newSale() {
    cart = [];
    document.getElementById('billing-discount').value = '0';
    updateCartUI();
    scanner.focus();
    showToast('New sale started', 'info');
  }

  return {
    init
  };
})();
