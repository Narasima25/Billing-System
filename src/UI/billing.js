// ═══════════════════════════════════════════════════════════════════════════
//  UI/billing.js — POS Billing Module
//  Full-featured point-of-sale with barcode scanning, cart management,
//  GST calculation, payment modes, customer capture, and receipt printing.
// ═══════════════════════════════════════════════════════════════════════════

const BillingModule = (() => {
  const panel = document.getElementById('panel-billing');

  let initialized = false;
  let cart = [];
  let scanner;
  let selectedPaymentMode = 'cash';
  let discountMode = 'amount';
  let currentGrandTotalPaise = 0;
  let invInput = null;
  let isInvoiceNumberEdited = false;

  let cachedShopUpiId = null;
  let cachedStoreName = null;
  let cachedShopStateCode = null;
  let settingsCached = false;

  async function cacheSettings() {
    if (!settingsCached) {
      cachedShopUpiId = await window.api.settings.get('shop_upi_id');
      cachedStoreName = (await window.api.settings.get('store_name')) || 'SKY PETS';
      cachedShopStateCode = await window.api.settings.get('shop_state_code');
      settingsCached = true;
    }
  }

  function init() {
    if (!initialized) {
      render();
      bindEvents();
      initialized = true;
    }
    // Fetch settings asynchronously so they don't block
    cacheSettings();
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
            
            <div class="customer-search-wrap" style="position: relative; margin: 0 0 12px 0;">
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

            <!-- Invoice Details Section -->
            <div style="display: flex; gap: 10px; margin-bottom: 16px;">
              <div style="flex: 1;">
                <label style="font-size:12px; font-weight:600; margin-bottom:4px; display:flex; align-items:center; gap:4px; color:var(--text-muted);"><i data-lucide="file-text" style="width:14px; height:14px;"></i> <span id="billing-invoice-label-text">R.N (Receipt Number)</span></label>
                <input type="text" class="form-input" id="billing-invoice-number" placeholder="Auto Generated" style="font-weight: bold; color: var(--text-primary); border: 1px dashed var(--border); background-color: var(--bg-hover); cursor: not-allowed;" readonly disabled>
              </div>
              <div style="flex: 1;">
                <label style="font-size:12px; font-weight:600; margin-bottom:4px; display:flex; align-items:center; gap:4px;"><i data-lucide="calendar" style="width:14px; height:14px;"></i> Billing Date</label>
                <input type="date" class="form-input" id="billing-invoice-date">
              </div>
            </div>

            <!-- Customer Loyalty Section -->
            <div id="loyalty-section" class="checkout-row" style="flex-direction: column; align-items: stretch; gap: 8px; margin-bottom: 16px; background: var(--bg-card); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border);">
              <label style="font-weight: 600; display:flex; align-items:center; gap: 6px;"><i data-lucide="user"></i> Customer Details</label>
              <input type="text" class="form-input" id="billing-customer-phone" placeholder="Enter Phone Number (10 digits)" maxlength="10">
              <input type="text" class="form-input" id="billing-customer-name" placeholder="Customer Name (Optional)" style="display:none; margin-top:4px;">
              <div id="customer-info" style="display:none; font-size: 13px; margin-top: 4px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                  <span id="cust-name-badge" class="badge" style="background:var(--accent-blue);color:#fff;">New Customer</span>
                  <span id="cust-balance" style="font-weight:700; color:var(--accent-teal);">Balance: ₹0.00</span>
                </div>
                <div id="coupon-apply-wrap" style="display:none; margin-top:8px;">
                  <label style="font-size:12px; font-weight:600; margin-bottom:4px; display:block;">Apply Coupon Discount (₹)</label>
                  <input type="number" id="billing-applied-coupon" class="form-input" placeholder="Amount to apply" min="0" step="1">
                </div>
              </div>
            </div>

            <!-- B2B & Tax Options -->
            <div class="checkout-row" style="flex-direction: column; align-items: stretch; gap: 8px;">
              <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 5px;">
                <label style="display:flex; align-items:center; gap: 4px; cursor:pointer;"><input type="checkbox" id="chk-b2b"> B2B Sale</label>
                <label style="display:flex; align-items:center; gap: 4px; cursor:pointer;"><input type="checkbox" id="chk-inter-state"> Inter-State / Out of State</label>
              </div>
              <div id="b2b-fields" style="display:none; flex-direction:column; gap:8px;">
                <input type="text" class="form-input" id="b2b-name" placeholder="Customer Business Name" autocomplete="off">
                <input type="text" class="form-input" id="b2b-gstin" placeholder="15-digit GSTIN" autocomplete="off">
                <input type="text" class="form-input" id="b2b-address" placeholder="Customer Address" autocomplete="off">
                <input type="text" class="form-input" id="b2b-phone" placeholder="Customer Phone (Optional)" autocomplete="off">
              </div>
              <div id="inter-state-fields" style="display:none; flex-direction:column; gap:8px;">
                <select class="form-select" id="customer-state-code" style="font-size:13px;" autocomplete="off">
                  <option value="">-- Customer State --</option>
                  <option value="01">01 - Jammu & Kashmir</option>
                  <option value="02">02 - Himachal Pradesh</option>
                  <option value="03">03 - Punjab</option>
                  <option value="04">04 - Chandigarh</option>
                  <option value="05">05 - Uttarakhand</option>
                  <option value="06">06 - Haryana</option>
                  <option value="07">07 - Delhi</option>
                  <option value="08">08 - Rajasthan</option>
                  <option value="09">09 - Uttar Pradesh</option>
                  <option value="10">10 - Bihar</option>
                  <option value="11">11 - Sikkim</option>
                  <option value="12">12 - Arunachal Pradesh</option>
                  <option value="13">13 - Nagaland</option>
                  <option value="14">14 - Manipur</option>
                  <option value="15">15 - Mizoram</option>
                  <option value="16">16 - Tripura</option>
                  <option value="17">17 - Meghalaya</option>
                  <option value="18">18 - Assam</option>
                  <option value="19">19 - West Bengal</option>
                  <option value="20">20 - Jharkhand</option>
                  <option value="21">21 - Odisha</option>
                  <option value="22">22 - Chhattisgarh</option>
                  <option value="23">23 - Madhya Pradesh</option>
                  <option value="24">24 - Gujarat</option>
                  <option value="26">26 - Dadra & Nagar Haveli and Daman & Diu</option>
                  <option value="27">27 - Maharashtra</option>
                  <option value="29">29 - Karnataka</option>
                  <option value="30">30 - Goa</option>
                  <option value="31">31 - Lakshadweep</option>
                  <option value="32">32 - Kerala</option>
                  <option value="33">33 - Tamil Nadu</option>
                  <option value="34">34 - Puducherry</option>
                  <option value="35">35 - Andaman & Nicobar Islands</option>
                  <option value="36">36 - Telangana</option>
                  <option value="37">37 - Andhra Pradesh</option>
                  <option value="38">38 - Ladakh</option>
                  <option value="97">97 - Other Territory</option>
                </select>
              </div>
            </div>

            <!-- Totals -->
            <div id="billing-totals" class="mt-12">
              <div class="checkout-row">
                <span class="label">Taxable Value</span>
                <span class="value" id="billing-subtotal">₹0.00</span>
              </div>
              <div class="checkout-row" id="row-cgst">
                <span class="label">CGST</span>
                <span class="value" id="billing-cgst">₹0.00</span>
              </div>
              <div class="checkout-row" id="row-sgst">
                <span class="label">SGST</span>
                <span class="value" id="billing-sgst">₹0.00</span>
              </div>
              <div class="checkout-row" id="row-igst" style="display:none;">
                <span class="label">IGST</span>
                <span class="value" id="billing-igst">₹0.00</span>
              </div>
              <div class="checkout-row" id="row-coupon-discount" style="display:none;">
                <span class="label" style="color:var(--accent-teal);">Coupon Applied</span>
                <span class="value" id="billing-coupon-discount" style="color:var(--accent-teal);">-₹0.00</span>
              </div>
              <div class="discount-input-wrap" style="display:flex; gap:10px;">
                <div style="flex:1;">
                  <label style="font-size:12px; font-weight:600; color:var(--text-muted); margin-bottom:4px; display:block;">Disc (%)</label>
                  <input type="number" id="billing-discount-percent" class="form-input" value="0" min="0" step="0.01">
                </div>
                <div style="flex:1;">
                  <label style="font-size:12px; font-weight:600; color:var(--text-muted); margin-bottom:4px; display:block;">Disc (₹)</label>
                  <input type="number" id="billing-discount" class="form-input" value="0" min="0" step="0.01">
                </div>
              </div>
              <div class="checkout-row total">
                <span class="label">Grand Total</span>
                <div style="display:flex; align-items:center; justify-content:flex-end;">
                  <span style="color:var(--accent-primary); font-weight:700; margin-right:2px; font-size:24px;">₹</span>
                  <input type="number" id="billing-grand-total" class="form-input" style="font-size:24px; font-weight:700; color:var(--accent-primary); width:120px; text-align:right; padding:0; background:transparent; border:none; outline:none; box-shadow:none; -moz-appearance:textfield;" value="0.00" min="0" step="0.01">
                </div>
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
            
            <div id="live-upi-qr-container" style="display:none; text-align:center; margin-top: 16px; padding: 12px; background: rgba(124,58,237,0.05); border: 2px dashed var(--accent-violet); border-radius: 8px;">
              <div style="font-size: 13px; font-weight: 800; color: var(--accent-violet); margin-bottom: 8px;">Scan to Pay ₹<span id="live-upi-amt">0.00</span></div>
              <canvas id="live-upi-qr-canvas"></canvas>
            </div>
          </div>

          <!-- Actions -->
          <div class="pos-checkout-panel">
            <div style="margin-bottom: 12px; display: flex; align-items: center; justify-content: center; gap: 8px;">
              <input type="checkbox" id="billing-send-whatsapp" checked style="accent-color: var(--accent-primary); width: 16px; height: 16px; cursor: pointer;">
              <label for="billing-send-whatsapp" style="font-size: 14px; font-weight: 600; cursor: pointer; color: var(--accent-green);"><i data-lucide="message-circle" style="width: 16px; height: 16px; margin-bottom: -3px;"></i> Send WhatsApp Receipt</label>
            </div>
            <div class="checkout-actions" style="flex-wrap: wrap; gap: 8px;">
              <button class="btn btn-secondary" onclick="openModal('modal-process-return')" style="flex:1;"><i data-lucide="rotate-ccw"></i> Returns</button>
              <button class="btn btn-danger" id="billing-clear-btn" style="flex:1;">✕ Clear</button>
              <button class="btn btn-primary btn-lg" id="billing-checkout-btn" style="flex:100%; margin-top:4px;">
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
    // Global Scanner Buffer (Optimized for Mobile & Hardware Machine Scanners)
    let scanBuffer = '';
    let scanTimer = null;
    let lastKeyTime = Date.now();

    // Bug fix #1: IDs of inputs that should NOT feed into the scan buffer.
    // When a user is typing into these fields (phone, search, discount, etc.),
    // keystrokes must not accumulate in scanBuffer to prevent false barcode detection.
    const ignoredInputIds = new Set([
      'billing-customer-phone', 'billing-customer-name', 'billing-manual-search',
      'billing-discount', 'billing-discount-percent', 'billing-applied-coupon',
      'billing-grand-total', 'billing-invoice-number', 'billing-invoice-date',
      'b2b-name', 'b2b-gstin', 'b2b-address', 'b2b-phone', 'customer-state-code',
      'return-receipt-number'
    ]);

    function isIgnoredInput() {
      const el = document.activeElement;
      if (!el || (el.tagName !== 'INPUT' && el.tagName !== 'SELECT')) return false;
      if (el === scanner) return true; // Scanner handles its own events now
      return ignoredInputIds.has(el.id);
    }

    if (scanner) {
      let scannerInputTimer = null;
      
      scanner.addEventListener('input', () => {
        clearTimeout(scannerInputTimer);
        scannerInputTimer = setTimeout(async () => {
          const barcode = scanner.value.trim();
          if (barcode.length >= 3) {
            scanner.value = '';
            await handleScan(barcode);
          }
        }, 400); // 400ms debounce for hardware scanners or mobile virtual keyboards
      });

      scanner.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter' || e.keyCode === 13) {
          e.preventDefault();
          e.stopPropagation();
          clearTimeout(scannerInputTimer);
          const barcode = scanner.value.trim();
          if (barcode.length >= 3) {
            scanner.value = '';
            await handleScan(barcode);
          }
        }
      });
    }

    document.addEventListener('keydown', async (e) => {
      if (!panel.classList.contains('active') || document.querySelector('.modal-overlay.visible')) return;

      if (e.key === 'Enter') {
        // If focused on a known input field, do NOT treat scanBuffer as a barcode
        if (isIgnoredInput()) {
          scanBuffer = '';
          return;
        }

        let barcode = scanBuffer;

        // Optimization for hardware machine scanners directly in the input
        if (scanner && document.activeElement === scanner && scanner.value.trim().length > 0) {
          barcode = scanner.value.trim();
        }

        if (barcode && barcode.length >= 3) {
          e.preventDefault();
          e.stopPropagation();
          
          // If the barcode was accidentally typed into another input natively, strip it out
          if (document.activeElement && document.activeElement.tagName === 'INPUT' && document.activeElement !== scanner) {
             const val = document.activeElement.value.toString();
             if (val && val.endsWith(barcode)) {
               document.activeElement.value = val.slice(0, -barcode.length);
               document.activeElement.dispatchEvent(new Event('input', { bubbles: true }));
             }
             document.activeElement.blur(); // Remove focus so subsequent scans don't go here
          }

          scanBuffer = '';
          if (scanner) scanner.value = '';
          await handleScan(barcode);
          return;
        }

        scanBuffer = '';
        return;
      }

      // Bug fix #1: Do NOT accumulate keystrokes in scanBuffer when typing in known input fields
      if (isIgnoredInput()) return;

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const currentTime = Date.now();
        // Hardware scanners can sometimes take up to 50-80ms per char.
        if (currentTime - lastKeyTime > 150) {
          scanBuffer = '';
        }
        lastKeyTime = currentTime;

        scanBuffer += e.key;
        
        clearTimeout(scanTimer);
        scanTimer = setTimeout(async () => {
          let barcode = scanBuffer;
          if (scanner && document.activeElement === scanner && scanner.value.trim().length > 0) {
            barcode = scanner.value.trim();
          }
          if (barcode && barcode.length >= 3) {
            scanBuffer = '';
            if (scanner) scanner.value = '';
            await handleScan(barcode);
          } else {
            scanBuffer = '';
          }
        }, 300);
      }
    });

    // Add barcode manually via button
    const btnAddBarcode = document.getElementById('btn-add-barcode');
    if (btnAddBarcode) {
      btnAddBarcode.addEventListener('click', () => {
        const barcode = scanner.value.trim();
        if (barcode.length >= 3) {
          handleScan(barcode);
        } else {
          showToast('Please enter a valid barcode', 'warning');
        }
      });
    }
    
    // Initialize billing date and fetch next receipt number
    const dateInput = document.getElementById('billing-invoice-date');
    invInput = document.getElementById('billing-invoice-number');
    isInvoiceNumberEdited = false;
    
    async function updateReceiptNumber() {
      if (invInput) {
        const nextNum = await window.api.billing.getNextReceiptNumber(dateInput ? dateInput.value : null);
        invInput.value = nextNum;
        isInvoiceNumberEdited = false;
      }
    }

    if (invInput) {
      invInput.addEventListener('input', () => {
        isInvoiceNumberEdited = true;
      });
    }

    if (dateInput) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      dateInput.value = `${yyyy}-${mm}-${dd}`;
      dateInput.addEventListener('change', updateReceiptNumber);
    }
    
    // Initial fetch of receipt number
    updateReceiptNumber();

    // Payment mode buttons
    panel.addEventListener('click', (e) => {
      const pmBtn = e.target.closest('.payment-mode-btn');
      if (pmBtn) {
        panel.querySelectorAll('.payment-mode-btn').forEach(b => b.classList.remove('active'));
        pmBtn.classList.add('active');
        selectedPaymentMode = pmBtn.dataset.mode;
        updateLiveQR();
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
      if (e.target.id === 'billing-discount') {
        discountMode = 'amount';
        updateTotals();
      } else if (e.target.id === 'billing-discount-percent') {
        discountMode = 'percent';
        updateTotals();
      } else if (e.target.id === 'billing-applied-coupon') {
        updateTotals();
      } else if (e.target.id === 'billing-grand-total') {
        reverseCalculateDiscount(e.target.value);
      }
    });

    // Customer Phone lookup
    const phoneInput = document.getElementById('billing-customer-phone');
    let phoneTimer = null;
    if (phoneInput) {
      phoneInput.addEventListener('input', (e) => {
        // Allow only numbers
        e.target.value = e.target.value.replace(/\D/g, '');
        const phone = e.target.value;
        const infoDiv = document.getElementById('customer-info');
        const badge = document.getElementById('cust-name-badge');
        const balSpan = document.getElementById('cust-balance');
        const couponWrap = document.getElementById('coupon-apply-wrap');
        const couponInput = document.getElementById('billing-applied-coupon');
        const nameInput = document.getElementById('billing-customer-name');

        if (phone.length === 10) {
          clearTimeout(phoneTimer);
          phoneTimer = setTimeout(async () => {
            try {
              const res = await window.api.billing.getCustomer(phone);
              infoDiv.style.display = 'block';
              nameInput.style.display = 'block';
              if (res.success && res.customer) {
                const cust = res.customer;
                badge.textContent = cust.name || 'Returning Customer';
                nameInput.value = cust.name || '';
                badge.style.background = 'var(--accent-teal)';
                balSpan.textContent = 'Balance: ' + formatRupees(cust.coupon_balance_paise);
                if (cust.coupon_balance_paise > 0) {
                  couponWrap.style.display = 'block';
                } else {
                  couponWrap.style.display = 'none';
                  couponInput.value = '';
                }
              } else {
                badge.textContent = 'New Customer';
                nameInput.value = '';
                badge.style.background = 'var(--accent-blue)';
                balSpan.textContent = 'Balance: ₹0.00';
                couponWrap.style.display = 'none';
                couponInput.value = '';
              }
            } catch (err) { }
          }, 300);
        } else {
          infoDiv.style.display = 'none';
          nameInput.style.display = 'none';
          if (couponInput.value !== '') {
            couponInput.value = '';
            updateTotals(); // in case they cleared phone
          }
        }
      });
      
      // Allow pressing Enter to quickly navigate back to the product search
      phoneInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const manualSearch = document.getElementById('billing-manual-search');
          if (manualSearch) {
            manualSearch.focus();
            manualSearch.select();
          }
        }
      });
    }

    // B2B & Tax toggles
    panel.addEventListener('change', (e) => {
      if (e.target.id === 'chk-b2b') {
        const fields = document.getElementById('b2b-fields');
        const invoiceLabelText = document.getElementById('billing-invoice-label-text');
        fields.style.display = e.target.checked ? 'flex' : 'none';
        if (e.target.checked) {
          document.getElementById('b2b-name').focus();
          if (invoiceLabelText) invoiceLabelText.textContent = 'I.N (Invoice Number)';
        } else {
          // Clear item discounts when unticking B2B
          cart.forEach(item => item.discountPaise = 0);
          if (invoiceLabelText) invoiceLabelText.textContent = 'R.N (Receipt Number)';
        }
        updateCartUI();
      }
      if (e.target.id === 'chk-inter-state') {
        const interStateFields = document.getElementById('inter-state-fields');
        const rowCgst = document.getElementById('row-cgst');
        const rowSgst = document.getElementById('row-sgst');
        const rowIgst = document.getElementById('row-igst');
        if (e.target.checked) {
          interStateFields.style.display = 'flex';
          rowCgst.style.display = 'none';
          rowSgst.style.display = 'none';
          rowIgst.style.display = 'flex';
        } else {
          interStateFields.style.display = 'none';
          document.getElementById('customer-state-code').value = '';
          rowCgst.style.display = 'flex';
          rowSgst.style.display = 'flex';
          rowIgst.style.display = 'none';
        }
        updateTotals();
      }
    });

    // Auto-detect inter-state from GSTIN (B2B): compare first 2 digits vs shop_state_code
    document.getElementById('b2b-gstin').addEventListener('input', async (e) => {
      const gstin = e.target.value.trim();
      if (gstin.length >= 2) {
        const custStateCode = gstin.substring(0, 2);
        try {
          if (!settingsCached) await cacheSettings();
          const shopState = cachedShopStateCode;
          if (shopState && custStateCode !== shopState) {
            document.getElementById('chk-inter-state').checked = true;
            document.getElementById('inter-state-fields').style.display = 'flex';
            document.getElementById('customer-state-code').value = custStateCode;
            document.getElementById('row-cgst').style.display = 'none';
            document.getElementById('row-sgst').style.display = 'none';
            document.getElementById('row-igst').style.display = 'flex';
          } else if (shopState && custStateCode === shopState) {
            document.getElementById('chk-inter-state').checked = false;
            document.getElementById('inter-state-fields').style.display = 'none';
            document.getElementById('customer-state-code').value = '';
            document.getElementById('row-cgst').style.display = 'flex';
            document.getElementById('row-sgst').style.display = 'flex';
            document.getElementById('row-igst').style.display = 'none';
          }
          updateTotals();
        } catch (err) { /* ignore settings fetch error */ }
      }
    });

    // Manual Product Search (By Name)
    const manualSearch = document.getElementById('billing-manual-search');
    let manualTimer = null;
    let manualSelectedIndex = -1;

    manualSearch.addEventListener('input', () => {
      clearTimeout(manualTimer);
      manualTimer = setTimeout(async () => {
        manualSelectedIndex = -1;
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
          resultsDiv.innerHTML = products.map((p, idx) => {
            const isService = (p.category_name || '').toLowerCase().includes('service') || (p.barcode || '').startsWith('SRV-');
            const isOOS = !isService && p.stock_quantity <= 0;
            const stockDisplay = isService ? '' : `<div class="text-sm ${isOOS ? 'text-rose' : 'text-green'}" style="margin-top:2px;">Stock: ${p.stock_quantity}</div>`;
            return `<div class="customer-result-item" data-barcode="${p.barcode}" data-index="${idx}" style="display:flex; justify-content:space-between; align-items:center; ${isOOS ? 'opacity:0.6;' : ''}">
               <div>
                 <strong>${p.product_name}</strong> <span class="text-xs text-muted" style="margin-left:4px;">${p.barcode}</span>
                 ${stockDisplay}
               </div>
               <div class="fw-700">${formatRupees(p.selling_price_paise)}</div>
             </div>`;
          }).join('');
        }
        resultsDiv.classList.add('show');
      }, 300);
    });

    manualSearch.addEventListener('keydown', async (e) => {
      const resultsDiv = document.getElementById('billing-manual-results');
      
      if (e.key === 'Enter') {
        e.preventDefault();
        
        if (resultsDiv.classList.contains('show')) {
          const items = resultsDiv.querySelectorAll('.customer-result-item[data-barcode]');
          if (manualSelectedIndex >= 0 && manualSelectedIndex < items.length) {
            items[manualSelectedIndex].click();
            return;
          }
        }
        
        const val = manualSearch.value.trim();
        if (val.length >= 3) {
          resultsDiv.classList.remove('show');
          manualSearch.value = '';
          await handleScan(val);
        }
        return;
      }

      if (!resultsDiv.classList.contains('show')) return;
      
      const items = resultsDiv.querySelectorAll('.customer-result-item[data-barcode]');
      if (items.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        manualSelectedIndex = (manualSelectedIndex + 1) % items.length;
        updateManualSelection(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        manualSelectedIndex = (manualSelectedIndex - 1 + items.length) % items.length;
        updateManualSelection(items);
      }
    });

    function updateManualSelection(items) {
      items.forEach((item, idx) => {
        if (idx === manualSelectedIndex) {
          item.style.backgroundColor = 'var(--bg-hover, #f1f5f9)';
          item.scrollIntoView({ block: 'nearest' });
        } else {
          item.style.backgroundColor = '';
        }
      });
    }

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
        if (!item._isService && item._stockQty && (item.quantity + (item.freeQuantity || 0)) >= item._stockQty) {
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

    let cartInputTimer = null;
    document.getElementById('billing-cart-items').addEventListener('input', (e) => {
      const idx = parseInt(e.target.closest('[data-index]')?.dataset.index);
      if (isNaN(idx)) return;

      if (e.target.classList.contains('ci-qty-input')) {
        let newQty = parseInt(e.target.value);
        const item = cart[idx];
        if (!isNaN(newQty) && newQty >= 1) {
          if (!item._isService && item._stockQty && (newQty + (item.freeQuantity || 0)) > item._stockQty) {
            newQty = Math.max(1, item._stockQty - (item.freeQuantity || 0));
            e.target.value = newQty;
            showToast(`Maximum stock reached (${item._stockQty})`, 'warning');
          }
          item.quantity = newQty;
        }
      } else if (e.target.classList.contains('ci-price-input')) {
        const newPrice = parseFloat(e.target.value);
        if (!isNaN(newPrice) && newPrice >= 0) {
          cart[idx].unitPricePaise = Math.round(newPrice * 100);
        }
      } else if (e.target.classList.contains('ci-discount-input')) {
        const newDiscount = parseFloat(e.target.value);
        if (!isNaN(newDiscount) && newDiscount >= 0) {
          cart[idx].discountPaise = Math.round(newDiscount * 100);
        }
      } else if (e.target.classList.contains('ci-free-input')) {
        let newFreeQty = parseInt(e.target.value);
        const item = cart[idx];
        if (!isNaN(newFreeQty) && newFreeQty >= 0) {
          if (!item._isService && item._stockQty && (item.quantity + newFreeQty) > item._stockQty) {
            newFreeQty = Math.max(0, item._stockQty - item.quantity);
            e.target.value = newFreeQty;
            showToast(`Maximum stock reached (${item._stockQty})`, 'warning');
          }
          item.freeQuantity = newFreeQty;
        }
      }

      const discountAmount = cart[idx].discountPaise || 0;
      const lineTotal = (cart[idx].unitPricePaise * cart[idx].quantity) - discountAmount;
      e.target.closest('.cart-item').querySelector('.ci-total').textContent = formatRupees(Math.max(0, lineTotal));

      clearTimeout(cartInputTimer);
      cartInputTimer = setTimeout(updateTotals, 300);
    });

    document.getElementById('billing-cart-items').addEventListener('change', (e) => {
      if (e.target.tagName === 'INPUT') {
        updateCartUI();
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (!panel.classList.contains('active')) return;
      if (e.target.closest('.modal-overlay')) return;

      if (e.key === 'F2') { e.preventDefault(); newSale(); }
      if (e.key === 'F8') { e.preventDefault(); handleCheckout(); }
    });

    // Removed aggressive focus stealing interval. Global keystrokes are already captured by the keydown listener.
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
      const cartQty = existing ? (existing.quantity + (existing.freeQuantity || 0)) : 0;
      const isService = (product.category_name || '').toLowerCase().includes('service') || (product.barcode || '').startsWith('SRV-');

      if (!isService && product.stock_quantity <= 0) {
        flash.innerHTML = `<div class="oos-alert">🚫 <strong>${product.product_name}</strong> is <strong>OUT OF STOCK</strong></div>`;
        showToast('OUT OF STOCK — Cannot add to bill', 'warning');
        setTimeout(() => flash.innerHTML = '', 4000);
        return;
      }

      if (!isService && cartQty >= product.stock_quantity) {
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
          _isService: isService,
          supplierName: product.supplier_name || 'N/A',
          batchNumber: firstBatch ? firstBatch.batch_number : 'N/A',
          originalCostPaise: product.base_price_paise || 0,
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
    const isB2B = document.getElementById('chk-b2b') ? document.getElementById('chk-b2b').checked : false;

    if (cart.length === 0) {
      emptyState.style.display = '';
      cartArea.innerHTML = '';
      countSpan.textContent = '0 items';
    } else {
      emptyState.style.display = 'none';
      countSpan.textContent = `${cart.length} item${cart.length > 1 ? 's' : ''}`;
      cartArea.innerHTML = cart.map((item, idx) => {
        const discountAmount = item.discountPaise || 0;
        const lineTotal = (item.unitPricePaise * item.quantity) - discountAmount;

        return `
          <div class="cart-item" data-index="${idx}" style="flex-direction: column; align-items: stretch; gap: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="flex: 1; cursor: pointer;" onclick="document.getElementById('ci-details-${idx}').style.display = document.getElementById('ci-details-${idx}').style.display === 'none' ? 'flex' : 'none'" title="Click to view details & cost price">
                <div class="ci-name">${item.productName}</div>
                <div class="ci-barcode" style="display:flex; align-items:center; gap:4px;">
                  ${item.barcode} 
                  <i data-lucide="chevron-down" style="width:14px; height:14px; color:var(--text-muted);"></i>
                </div>
              </div>
              <div class="qty-control" style="margin-right: 12px; display: flex; align-items: center; gap: 4px;">
                <button class="qty-minus" title="Decrease">−</button>
                <input type="number" class="ci-qty-input" value="${item.quantity}" min="1" ${item._isService ? '' : `max="${item._stockQty || ''}"`} style="width: 45px; text-align: center; border: 1px solid var(--border); border-radius: var(--radius-sm); font-weight: 600; padding: 4px 0; background: var(--bg-input); color: var(--text-primary); outline: none;">
                <button class="qty-plus" title="Increase">+</button>
              </div>
              <div style="display: flex; align-items: center; gap: 4px; margin-right: 12px;">
                <span style="font-size: 13px; font-weight: 600; color: var(--text-muted);">₹</span>
                <input type="number" class="ci-price-input" value="${(item.unitPricePaise / 100).toFixed(2)}" step="0.01" min="0" style="width: 75px; padding: 6px 8px; border: 1px solid var(--border); border-radius: var(--radius-sm); text-align: right; font-weight: 700; background: var(--bg-input); color: var(--text-primary); outline: none;">
              </div>
              <span class="ci-total" style="width: 80px; text-align: right; margin-right: 12px;">${formatRupees(Math.max(0, lineTotal))}</span>
              <button class="ci-remove" title="Remove">✕</button>
            </div>
            <div id="ci-details-${idx}" style="display: none; flex-wrap: wrap; font-size: 11px; color: var(--text-muted); align-items: center; gap: 16px; border-top: 1px dashed var(--border); padding-top: 6px; margin-top: 2px;">
              <span style="display: flex; align-items: center;"><i data-lucide="truck" style="width:12px;height:12px;margin-right:4px;"></i> ${item.supplierName}</span>
              <span style="display: flex; align-items: center;"><i data-lucide="layers" style="width:12px;height:12px;margin-right:4px;"></i> Batch: ${item.batchNumber}</span>
              <span style="display: flex; align-items: center; color: var(--accent-blue); font-weight: 600;">
                Base Price: ${formatRupees(item.originalCostPaise)}
              </span>
              
              <div style="margin-left: auto; display: flex; gap: 12px; align-items: center;">
                <label style="display: flex; align-items: center; gap: 4px; ${!isB2B ? 'opacity: 0.5; pointer-events: none;' : ''}">
                  Discount: ₹
                  <input type="number" class="ci-discount-input" value="${((item.discountPaise || 0) / 100).toFixed(2)}" step="0.01" min="0" ${!isB2B ? 'disabled' : ''} style="width: 60px; padding: 2px 4px; font-size: 11px; border: 1px solid var(--border); border-radius: 2px;">
                </label>
                <label style="display: flex; align-items: center; gap: 4px;">
                  Free Qty:
                  <input type="number" class="ci-free-input" value="${item.freeQuantity || 0}" min="0" step="1" style="width: 40px; padding: 2px 4px; font-size: 11px; border: 1px solid var(--border); border-radius: 2px;">
                </label>
              </div>
            </div>
          </div>`;
      }).join('');
      if (window.lucide) {
        const cartEl = document.getElementById('billing-cart-items');
        if (cartEl) window.lucide.createIcons({ node: cartEl });
      }
    }

    updateTotals();
  }

  function reverseCalculateDiscount(desiredTotalStr) {
    const desiredTotal = parseFloat(desiredTotalStr) || 0;
    const desiredTotalPaise = Math.round(desiredTotal * 100);
    
    let totalGrossPaise = 0;
    cart.forEach(item => {
      const itemDisc = item.discountPaise || 0;
      totalGrossPaise += Math.max(0, (item.unitPricePaise * item.quantity) - itemDisc);
    });

    let appliedCouponPaise = parseRupeesToPaise(document.getElementById('billing-applied-coupon') ? document.getElementById('billing-applied-coupon').value || '0' : '0');

    let requiredDiscountPaise = totalGrossPaise - desiredTotalPaise - appliedCouponPaise;
    if (requiredDiscountPaise < 0) requiredDiscountPaise = 0;

    discountMode = 'amount';
    document.getElementById('billing-discount').value = (requiredDiscountPaise / 100).toFixed(2);
    
    if (document.getElementById('billing-discount-percent')) {
      document.getElementById('billing-discount-percent').value = totalGrossPaise > 0 ? ((requiredDiscountPaise / totalGrossPaise) * 100).toFixed(2) : '0';
    }

    updateTotals();
  }

  function updateTotals() {
    let totalGrossPaise = 0;
    cart.forEach(item => {
      const discount = item.discountPaise || 0;
      totalGrossPaise += Math.max(0, (item.unitPricePaise * item.quantity) - discount);
    });

    if (discountMode === 'percent') {
      const pct = parseFloat(document.getElementById('billing-discount-percent') ? document.getElementById('billing-discount-percent').value : '0') || 0;
      const amtPaise = Math.round((totalGrossPaise * pct) / 100);
      document.getElementById('billing-discount').value = (amtPaise / 100).toFixed(2);
    } else {
      const amtPaise = parseRupeesToPaise(document.getElementById('billing-discount').value || '0');
      if (document.getElementById('billing-discount-percent')) {
        if (totalGrossPaise > 0) {
          document.getElementById('billing-discount-percent').value = ((amtPaise / totalGrossPaise) * 100).toFixed(2);
        } else {
          document.getElementById('billing-discount-percent').value = '0';
        }
      }
    }

    const discountPaise = parseRupeesToPaise(document.getElementById('billing-discount').value || '0');
    let appliedCouponPaise = parseRupeesToPaise(document.getElementById('billing-applied-coupon') ? document.getElementById('billing-applied-coupon').value || '0' : '0');
    
    const isB2B = document.getElementById('chk-b2b') ? document.getElementById('chk-b2b').checked : false;
    const isB2CSmall = !isB2B && ((totalGrossPaise - discountPaise) <= 25000000); // <= 2.5L

    const loyaltySection = document.getElementById('loyalty-section');
    if (loyaltySection) {
      if (isB2CSmall) {
        loyaltySection.style.display = 'flex';
      } else {
        loyaltySection.style.display = 'none';
        appliedCouponPaise = 0;
        document.getElementById('billing-customer-phone').value = '';
        if (document.getElementById('billing-customer-name')) {
          document.getElementById('billing-customer-name').value = '';
          document.getElementById('billing-customer-name').style.display = 'none';
        }
        document.getElementById('customer-info').style.display = 'none';
        document.getElementById('billing-applied-coupon').value = '';
      }
    }

    const totalGlobalDiscountPaise = discountPaise + appliedCouponPaise;

    let subtotal = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    const isInterState = document.getElementById('chk-inter-state') ? document.getElementById('chk-inter-state').checked : false;

    let distributedDiscount = 0;

    cart.forEach((item, idx) => {
      const itemDiscount = item.discountPaise || 0;
      const itemGross = Math.max(0, (item.unitPricePaise * item.quantity) - itemDiscount);
      
      let itemGlobalDiscount = 0;
      if (idx === cart.length - 1) {
        itemGlobalDiscount = Math.max(0, totalGlobalDiscountPaise - distributedDiscount);
        // Fallback: If for some reason the remaining discount is more than itemGross, cap it, though it shouldn't happen usually
        itemGlobalDiscount = Math.min(itemGlobalDiscount, itemGross); 
      } else {
        const proportion = totalGrossPaise > 0 ? (itemGross / totalGrossPaise) : 0;
        itemGlobalDiscount = Math.round(proportion * totalGlobalDiscountPaise);
        itemGlobalDiscount = Math.min(itemGlobalDiscount, itemGross); // Cap at item gross
      }
      distributedDiscount += itemGlobalDiscount;

      const lineTotalAfterGlobalDisc = Math.max(0, itemGross - itemGlobalDiscount);

      if (item.gstPercent > 0) {
        // GST is inclusive in MRP. Reverse calculate taxable value.
        const taxableValue = Math.round((lineTotalAfterGlobalDisc * 100) / (100 + item.gstPercent));
        const itemGst = lineTotalAfterGlobalDisc - taxableValue;

        if (isInterState) {
          igst += itemGst;
        } else {
          const halfGst = Math.round(itemGst / 2);
          cgst += halfGst;
          sgst += (itemGst - halfGst);
        }
        subtotal += taxableValue;
      } else {
        subtotal += lineTotalAfterGlobalDisc;
      }
    });

    const grandTotal = subtotal + cgst + sgst + igst;

    const rowCoupon = document.getElementById('row-coupon-discount');
    if (appliedCouponPaise > 0) {
      rowCoupon.style.display = 'flex';
      document.getElementById('billing-coupon-discount').textContent = '-' + formatRupees(appliedCouponPaise);
    } else {
      rowCoupon.style.display = 'none';
    }

    document.getElementById('billing-subtotal').textContent = formatRupees(subtotal);
    if (!isInterState) {
      document.getElementById('billing-cgst').textContent = formatRupees(cgst);
      document.getElementById('billing-sgst').textContent = formatRupees(sgst);
    } else {
      document.getElementById('billing-igst').textContent = formatRupees(igst);
    }
    
    const grandTotalInput = document.getElementById('billing-grand-total');
    if (document.activeElement !== grandTotalInput) {
      grandTotalInput.value = (Math.max(0, grandTotal) / 100).toFixed(2);
    }
    
    currentGrandTotalPaise = Math.max(0, grandTotal);
    updateLiveQR();
  }
  
  async function updateLiveQR() {
    const qrContainer = document.getElementById('live-upi-qr-container');
    const amtSpan = document.getElementById('live-upi-amt');
    
    if (selectedPaymentMode === 'upi' && currentGrandTotalPaise > 0) {
      try {
        if (!settingsCached) await cacheSettings();
        const shopUpiId = cachedShopUpiId;
        const storeName = cachedStoreName;
        
        if (shopUpiId && window.QRious) {
          qrContainer.style.display = 'block';
          amtSpan.textContent = (currentGrandTotalPaise / 100).toFixed(2);
          
          const upiString = `upi://pay?pa=${shopUpiId}&pn=${encodeURIComponent(storeName)}&am=${(currentGrandTotalPaise / 100).toFixed(2)}&cu=INR`;
          new QRious({
            element: document.getElementById('live-upi-qr-canvas'),
            value: upiString,
            size: 150,
            level: 'H'
          });
        } else {
          qrContainer.style.display = 'none';
        }
      } catch (err) {
        qrContainer.style.display = 'none';
      }
    } else {
      qrContainer.style.display = 'none';
    }
  }

  async function handleCheckout() {
    if (cart.length === 0) { showToast('Cart is empty - scan items first', 'warning'); return; }

    const discountPaise = parseRupeesToPaise(document.getElementById('billing-discount').value || '0');
    const appliedCouponPaise = parseRupeesToPaise(document.getElementById('billing-applied-coupon') ? document.getElementById('billing-applied-coupon').value || '0' : '0');

    const cartItems = cart.map(item => ({
      productId: item.productId,
      barcode: item.barcode,
      productName: item.productName,
      quantity: item.quantity,
      freeQuantity: item.freeQuantity || 0,
      unitPricePaise: item.unitPricePaise,
      discountPaise: item.discountPaise || 0,
      gstPercent: item.gstPercent,
      hsnCode: item.hsnCode,
    }));

    try {
      const isB2B = document.getElementById('chk-b2b').checked;
      const isInterState = document.getElementById('chk-inter-state').checked;
      let customerName = document.getElementById('b2b-name').value.trim();
      const customerGstin = document.getElementById('b2b-gstin').value.trim();

      if (isB2B && !customerName) {
        showToast('Please enter Business Name for B2B sale', 'warning');
        return;
      }

      const customerStateCode = document.getElementById('customer-state-code').value;
      const customerPhone = isB2B 
        ? (document.getElementById('b2b-phone') ? document.getElementById('b2b-phone').value.trim() : '')
        : (document.getElementById('billing-customer-phone') ? document.getElementById('billing-customer-phone').value.trim() : '');

      if (!isB2B && document.getElementById('billing-customer-name')) {
        customerName = document.getElementById('billing-customer-name').value.trim() || customerName;
      }

      let approxTotal = 0;
      cartItems.forEach(i => approxTotal += i.unitPricePaise * i.quantity);

      if (!isB2B && approxTotal > 25000000) {
        if (!customerName) {
          showToast('B2C Large (>?2.5L): Customer Name is MANDATORY', 'error');
          return;
        }
        if (!customerStateCode) {
          showToast('B2C Large (>?2.5L): Customer State is MANDATORY', 'error');
          return;
        }
      }

      if (!isB2B && approxTotal >= 100000 && approxTotal <= 25000000 && !customerPhone) {
        const proceed = await new Promise(resolve => {
          document.getElementById('btn-loyalty-cancel').onclick = () => {
            closeModal('modal-loyalty-confirm');
            resolve(false);
          };
          document.getElementById('btn-loyalty-continue').onclick = () => {
            closeModal('modal-loyalty-confirm');
            resolve(true);
          };
          openModal('modal-loyalty-confirm');
        });

        if (!proceed) {
          const phoneInput = document.getElementById('billing-customer-phone');
          if (phoneInput) phoneInput.focus();
          return;
        }
      }

      const checkoutResponse = await window.api.billing.checkout({
        cartItems: cartItems,
        paymentMode: selectedPaymentMode,
        discountPaise,
        userId: currentUser ? currentUser.id : null,
        isB2B,
        isInterState,
        customerName,
        customerGstin,
        customerStateCode,
        customerPhone,
        customerAddress: isB2B ? (document.getElementById('b2b-address') ? document.getElementById('b2b-address').value.trim() : '') : '',
        appliedCouponPaise,
        invoiceDate: document.getElementById('billing-invoice-date') ? document.getElementById('billing-invoice-date').value : null,
        sendWhatsappReceipt: document.getElementById('billing-send-whatsapp') ? document.getElementById('billing-send-whatsapp').checked : false,
      });
      
      if (!checkoutResponse.success) {
         throw new Error(checkoutResponse.error || 'Checkout failed');
      }
      
      const results = checkoutResponse.results || [];

      // Show confirmation modal
      const confirmDiv = document.getElementById('checkout-confirm-content');

      let rewardHtml = '';
      const totalReward = results.reduce((sum, r) => sum + (r.rewardEarnedPaise || 0), 0);
      if (totalReward > 0) {
        rewardHtml = `
          <div style="margin-top:16px; padding:12px; background:rgba(32, 201, 151, 0.1); border:1px dashed var(--accent-teal); border-radius:8px;">
            <div style="font-size:24px; margin-bottom:4px;">&#x1F381;</div>
            <div style="color:var(--accent-teal); font-weight:800; font-size:16px;">Reward Earned!</div>
            <div style="font-size:14px;">Tell the customer they won <b>${formatRupees(totalReward)}</b> for their next visit!</div>
          </div>
        `;
      }

      const receiptNumbers = results.map(r => r.receiptNumber).join(' <br> ');
      const grandTotals = results.reduce((sum, r) => sum + (r.grandTotalPaise || 0), 0);

      confirmDiv.innerHTML = `
        <div style="font-size:48px;margin-bottom:12px;">&#x2705;</div>
        <div style="font-size:20px;font-weight:800;margin-bottom:8px;">Sale Complete!</div>
        <div class="font-mono fw-700" style="font-size:16px;color:var(--accent-teal);margin-bottom:16px;">${receiptNumbers}</div>
        <div style="font-size:32px;font-weight:900;color:var(--accent-teal);">${formatRupees(grandTotals)}</div>
        <div class="text-muted text-sm mt-8">Payment: ${selectedPaymentMode.toUpperCase()}</div>
        ${rewardHtml}
      `;

      // Build receipts for printing
      document.getElementById('receipt-container').innerHTML = '';
      document.getElementById('invoice-container').innerHTML = '';
      for (let i = 0; i < results.length; i++) {
         if (i > 0) {
            document.getElementById('receipt-container').innerHTML += '<div style="margin: 16px 0; border-top: 1px dashed #000;"></div>';
            document.getElementById('invoice-container').innerHTML += '<div style="page-break-after: always; margin: 20px 0; border-top: 1px dashed #000;"></div>';
         }
         await buildReceipt(results[i], results[i].cartItems);
      }

      openModal('modal-checkout-confirm');

      // Reset
        cart = [];
        document.getElementById('billing-discount').value = '0';
        if (document.getElementById('billing-discount-percent')) {
          document.getElementById('billing-discount-percent').value = '0';
        }
        discountMode = 'amount';
        if (document.getElementById('billing-customer-phone')) {
          document.getElementById('billing-customer-phone').value = '';
          const infoDiv = document.getElementById('customer-info');
          if (infoDiv) infoDiv.style.display = 'none';
          const nameInput = document.getElementById('billing-customer-name');
          if (nameInput) {
            nameInput.value = '';
            nameInput.style.display = 'none';
          }
          const couponInput = document.getElementById('billing-applied-coupon');
          if (couponInput) couponInput.value = '';
        }
        document.getElementById('chk-b2b').checked = false;
        document.getElementById('b2b-fields').style.display = 'none';
        document.getElementById('b2b-name').value = '';
        document.getElementById('b2b-gstin').value = '';
        document.getElementById('chk-inter-state').checked = false;
        document.getElementById('inter-state-fields').style.display = 'none';
        document.getElementById('customer-state-code').value = '';
        document.getElementById('row-cgst').style.display = 'flex';
        document.getElementById('row-sgst').style.display = 'flex';
        document.getElementById('row-igst').style.display = 'none';
        if (document.getElementById('billing-send-whatsapp')) {
          document.getElementById('billing-send-whatsapp').checked = true;
        }
        updateCartUI();

      // Fetch new receipt number for the next sale
      if (invInput) {
        const nextNum = await window.api.billing.getNextReceiptNumber(document.getElementById('billing-invoice-date') ? document.getElementById('billing-invoice-date').value : null);
        invInput.value = nextNum;
        isInvoiceNumberEdited = false;
      }

      const receiptNumbersStr = results.map(r => r.receiptNumber).join(' & ');
      const grandTotalsSum = results.reduce((sum, r) => sum + (r.grandTotalPaise || 0), 0);
      showToast(`Sale ${receiptNumbersStr} - ${formatRupees(grandTotalsSum)}`, 'success');
    } catch (err) {
      console.error('[Billing] checkout error:', err);
      showToast('Checkout error: ' + (err.message || 'Unknown error'), 'error');
    }
    scanner.focus();
  }

  async function buildReceipt(saleResult, cartItems) {
    const receiptContainer = document.getElementById('receipt-container');
    const invoiceContainer = document.getElementById('invoice-container');
    const settings = await window.api.settings.getAll();
    const storeName = settings.store_name || 'SKY PETS';
    const storeAddress = settings.store_address || '';
    const storePhone = settings.store_phone || '';
    const shopGstin = settings.shop_gstin || '';
    const shopUpiId = settings.shop_upi_id || '';

    const receiptDate = saleResult.createdAt ? new Date(saleResult.createdAt.replace(' ', 'T')) : new Date();
    const dateStr = formatDate(receiptDate.toISOString());

    if (saleResult.isB2B) {
      document.body.classList.add('print-b2b');

      let invoiceItemsHtml = cartItems.map((item, idx) => {
        const discountAmount = item.discountPaise || 0;
        const lineTotal = (item.unitPricePaise * item.quantity) - discountAmount;

        let taxesHtml = '';
        let taxableValue = lineTotal;
        let itemGst = 0;

        if (item.gstPercent > 0) {
          taxableValue = Math.round((lineTotal * 100) / (100 + item.gstPercent));
          itemGst = lineTotal - taxableValue;
        }

        if (saleResult.isInterState) {
          const igst = itemGst;
          taxesHtml = `<td>${item.gstPercent}%</td><td>${formatRupees(igst)}</td>`;
        } else {
          const cgst = Math.round(itemGst / 2);
          const sgst = itemGst - cgst;
          taxesHtml = `<td>${item.gstPercent}%</td><td>${formatRupees(cgst)}</td><td>${formatRupees(sgst)}</td>`;
        }

        return `
          <tr>
            <td style="text-align:center;">${idx + 1}</td>
            <td>${item.productName}</td>
            <td>${item.hsnCode || ''}</td>
            <td style="text-align:right;">${item.quantity}</td>
            <td style="text-align:right;">${item.freeQuantity || 0}</td>
            <td style="text-align:right;">${formatRupees(item.unitPricePaise)}</td>
            <td style="text-align:right;">${formatRupees(discountAmount)}</td>
            <td style="text-align:right;">${formatRupees(taxableValue)}</td>
            ${taxesHtml}
            <td style="text-align:right;font-weight:bold;">${formatRupees(lineTotal)}</td>
          </tr>
        `;
      }).join('');

      let taxHeader = saleResult.isInterState
        ? `<th>IGST Rate</th><th>IGST Amt</th>`
        : `<th>GST Rate</th><th>CGST Amt</th><th>SGST Amt</th>`;

      invoiceContainer.innerHTML += `
        <div class="invoice-title" style="text-align: center; font-size: 24px; font-weight: bold; margin-bottom: 20px;">
          ${saleResult.isB2B ? 'TAX INVOICE' : 'RECEIPT'}
        </div>
        
        <div class="invoice-parties" style="display: flex; justify-content: space-between; margin-bottom: 20px;">
          <div style="flex: 1; text-align: left;">
            <div><b>Billed To:</b></div>
            ${saleResult.customerName ? `<div><b>${saleResult.customerName}</b></div>` : ''}
            ${saleResult.customerAddress ? `<div>${saleResult.customerAddress}</div>` : ''}
            ${saleResult.customerPhone ? `<div>Ph: ${saleResult.customerPhone}</div>` : ''}
            ${saleResult.customerGstin ? `<div>GSTIN: ${saleResult.customerGstin}</div>` : ''}
            ${saleResult.customerStateCode ? `<div>State Code: ${saleResult.customerStateCode}</div>` : ''}
          </div>
          
          <div style="flex: 1; text-align: center;">
            <div><b>Invoice No:</b> ${saleResult.receiptNumber}</div>
            <div><b>Date:</b> ${dateStr}</div>
            <div><b>Payment:</b> ${selectedPaymentMode.toUpperCase()}</div>
          </div>
          
          <div style="flex: 1; text-align: right;">
            <div><b>From:</b></div>
            <div style="font-weight:bold;">${storeName}</div>
            ${storeAddress ? `<div>${storeAddress}</div>` : ''}
            ${storePhone ? `<div>Ph: ${storePhone}</div>` : ''}
            ${shopGstin ? `<div>GSTIN: <b>${shopGstin}</b></div>` : ''}
          </div>
        </div>
        
        <table class="invoice-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Description of Goods</th>
              <th>HSN/SAC</th>
              <th>Qty</th>
              <th>Free</th>
              <th>Rate</th>
              <th>Discount</th>
              <th>Taxable Value</th>
              ${taxHeader}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${invoiceItemsHtml}
          </tbody>
        </table>
        
        <table class="invoice-totals">
          <tr>
            <td>Total Taxable Value</td>
            <td style="text-align:right;">${formatRupees(saleResult.subtotalPaise)}</td>
          </tr>
          ${saleResult.discountPaise > 0 ? `
          <tr>
            <td>Overall Discount <span style="font-size:10px; color:var(--text-muted);">(${((saleResult.subtotalPaise + saleResult.cgstPaise + saleResult.sgstPaise + saleResult.igstPaise + saleResult.discountPaise) > 0 ? (saleResult.discountPaise / (saleResult.subtotalPaise + saleResult.cgstPaise + saleResult.sgstPaise + saleResult.igstPaise + saleResult.discountPaise) * 100).toFixed(2) : '0.00')}%)</span></td>
            <td style="text-align:right;">-${formatRupees(saleResult.discountPaise)}</td>
          </tr>` : ''}
          ${saleResult.isInterState ? `
          <tr>
            <td>IGST Total</td>
            <td style="text-align:right;">${formatRupees(saleResult.igstPaise)}</td>
          </tr>` : `
          <tr>
            <td>CGST Total</td>
            <td style="text-align:right;">${formatRupees(saleResult.cgstPaise)}</td>
          </tr>
          <tr>
            <td>SGST Total</td>
            <td style="text-align:right;">${formatRupees(saleResult.sgstPaise)}</td>
          </tr>`}
          <tr>
            <td><b>GRAND TOTAL</b></td>
            <td style="text-align:right;"><b>${formatRupees(saleResult.grandTotalPaise)}</b></td>
          </tr>
        </table>
        
        <div style="margin-top:40px; display:flex; justify-content:space-between;">
          <div><br><br><b>Customer Signature</b></div>
          <div style="text-align:right;"><br><br><b>Authorized Signatory</b><br>${storeName}</div>
        </div>
      `;
    } else {
      document.body.classList.remove('print-b2b');

      let itemsHtml = cartItems.map(item => {
        const discountAmount = item.discountPaise || 0;
        const lineTotal = (item.unitPricePaise * item.quantity) - discountAmount;
        let html = `<div class="r-row"><span>${item.productName}${item.hsnCode ? ` <span style="font-size:10px;">(HSN: ${item.hsnCode})</span>` : ''}</span></div>`;
        html += `<div class="r-row"><span>&nbsp;&nbsp;${item.quantity} x ${formatRupees(item.unitPricePaise)}</span><span>${formatRupees(Math.max(0, lineTotal))}</span></div>`;
        if (item.freeQuantity > 0) {
          html += `<div class="r-row"><span>&nbsp;&nbsp;+ ${item.freeQuantity} Free</span><span></span></div>`;
        }
        if (discountAmount > 0) {
          html += `<div class="r-row"><span>&nbsp;&nbsp;Discount</span><span>-${formatRupees(discountAmount)}</span></div>`;
        }
        return html;
      }).join('');

      receiptContainer.innerHTML += `
        <div class="r-center r-bold" style="font-size:16px;">${storeName}</div>
        ${storePhone ? `<div class="r-center" style="font-size:10px;">Ph: ${storePhone}</div>` : ''}
        <div class="r-line"></div>
        <div class="r-row"><span>Receipt:</span><span>${saleResult.receiptNumber}</span></div>
        <div class="r-row"><span>Date:</span><span>${dateStr}</span></div>
        ${(saleResult.customerName || saleResult.customerPhone) ? `<div class="r-row"><span>Customer:</span><span>${saleResult.customerName || saleResult.customerPhone}</span></div>` : ''}
        <div class="r-line"></div>
        ${itemsHtml}
        <div class="r-line"></div>
        ${saleResult.discountPaise > 0 ? `<div class="r-row"><span>Cart Discount <span style="font-size:10px">(${((saleResult.subtotalPaise + saleResult.cgstPaise + saleResult.sgstPaise + saleResult.igstPaise + saleResult.discountPaise) > 0 ? (saleResult.discountPaise / (saleResult.subtotalPaise + saleResult.cgstPaise + saleResult.sgstPaise + saleResult.igstPaise + saleResult.discountPaise) * 100).toFixed(2) : '0.00')}%)</span></span><span>-${formatRupees(saleResult.discountPaise)}</span></div>` : ''}
        ${saleResult.appliedCouponPaise > 0 ? `<div class="r-row"><span>Coupon Applied</span><span>-${formatRupees(saleResult.appliedCouponPaise)}</span></div>` : ''}
        <div class="r-row"><span>Taxable Value</span><span>${formatRupees(saleResult.subtotalPaise)}</span></div>
        ${saleResult.isInterState ?
          `<div class="r-row"><span>IGST</span><span>${formatRupees(saleResult.igstPaise)}</span></div>` :
          `<div class="r-row"><span>CGST</span><span>${formatRupees(saleResult.cgstPaise)}</span></div>
           <div class="r-row"><span>SGST</span><span>${formatRupees(saleResult.sgstPaise)}</span></div>`
        }
        <div class="r-line"></div>
        <div class="r-row r-total"><span>GRAND TOTAL</span><span>${formatRupees(saleResult.grandTotalPaise)}</span></div>
        <div class="r-line"></div>
        <div class="r-row"><span>Payment:</span><span>${selectedPaymentMode.toUpperCase()}</span></div>
        ${saleResult.rewardEarnedPaise > 0 || saleResult.customerPhone ? `
        <div class="r-line"></div>
        ` : ''}
        ${saleResult.rewardEarnedPaise > 0 ? `
        <div class="r-center" style="font-weight:bold; margin-top:4px;">🎉 Congratulations! 🎉</div>
        <div class="r-center" style="font-size:11px;">You won a bonus coupon of: ${formatRupees(saleResult.rewardEarnedPaise)}</div>
        ` : ''}
        ${saleResult.customerPhone ? `
        <div class="r-center" style="font-size:11px; margin-top:4px; font-weight:bold;">Your Total Coupon Balance: ${formatRupees(saleResult.newCouponBalancePaise)}</div>
        <div class="r-center" style="font-size:10px;">(Valid on your next purchase!)</div>
        ` : ''}
        <div class="r-line"></div>
        <div class="r-center" style="margin-top:8px;">Thank You! Visit Again 🐾</div>
        <div class="r-center" style="font-size:10px; margin-top:4px;">${storeAddress}</div>
      `;

    }



    // Print button handler
    document.getElementById('btn-print-receipt').onclick = () => {
      window.print();
    };

    // Preview button handler
    const btnPreview = document.getElementById('btn-preview-receipt');
    if (btnPreview) {
      btnPreview.onclick = () => {
        const previewContent = document.getElementById('receipt-preview-content');
        if (saleResult.isB2B) {
          previewContent.innerHTML = invoiceContainer.innerHTML;
          previewContent.parentElement.style.width = '210mm'; // Expand modal for A4 preview
        } else {
          previewContent.innerHTML = receiptContainer.innerHTML;
          previewContent.parentElement.style.width = '340px'; // Reset modal to thermal width
        }
        openModal('modal-receipt-preview');
      };
    }
  }


  function newSale() {
    cart = [];
    document.getElementById('billing-discount').value = '0';
    if (document.getElementById('billing-discount-percent')) {
      document.getElementById('billing-discount-percent').value = '0';
    }
    discountMode = 'amount';
    if (document.getElementById('billing-customer-phone')) {
      document.getElementById('billing-customer-phone').value = '';
      const infoDiv = document.getElementById('customer-info');
      if (infoDiv) infoDiv.style.display = 'none';
      const nameInput = document.getElementById('billing-customer-name');
      if (nameInput) {
        nameInput.value = '';
        nameInput.style.display = 'none';
      }
      const couponInput = document.getElementById('billing-applied-coupon');
      if (couponInput) couponInput.value = '';
    }
    // Bug fix #12: Reset B2B and inter-state fields (same as handleCheckout)
    document.getElementById('chk-b2b').checked = false;
    document.getElementById('b2b-fields').style.display = 'none';
    document.getElementById('b2b-name').value = '';
    document.getElementById('b2b-gstin').value = '';
    if (document.getElementById('b2b-address')) document.getElementById('b2b-address').value = '';
    if (document.getElementById('b2b-phone')) document.getElementById('b2b-phone').value = '';
    document.getElementById('chk-inter-state').checked = false;
    document.getElementById('inter-state-fields').style.display = 'none';
    document.getElementById('customer-state-code').value = '';
    document.getElementById('row-cgst').style.display = 'flex';
    document.getElementById('row-sgst').style.display = 'flex';
    document.getElementById('row-igst').style.display = 'none';
    const invoiceLabelText = document.getElementById('billing-invoice-label-text');
    if (invoiceLabelText) invoiceLabelText.textContent = 'R.N (Receipt Number)';
    if (document.getElementById('billing-send-whatsapp')) {
      document.getElementById('billing-send-whatsapp').checked = true;
    }
    updateCartUI();
    scanner.focus();
    showToast('New sale started', 'info');
  }

  let currentReturnSale = null;

  async function fetchSaleForReturn() {
    const receiptNum = document.getElementById('return-receipt-number').value.trim();
    if (!receiptNum) return;

    const btn = document.getElementById('btn-fetch-return');
    btn.disabled = true;
    btn.textContent = '...';

    try {
      const result = await window.api.billing.getSaleForReturn(receiptNum);
      if (result.success) {
        currentReturnSale = result.sale;
        renderReturnItems();
        document.getElementById('return-items-section').style.display = 'block';
      } else {
        showToast(result.error || 'Receipt not found', 'error');
        document.getElementById('return-items-section').style.display = 'none';
        currentReturnSale = null;
      }
    } catch (err) {
      showToast('Connection error', 'error');
    }
    btn.disabled = false;
    btn.textContent = 'Fetch';
  }

  function renderReturnItems() {
    const tbody = document.querySelector('#table-return-items tbody');
    tbody.innerHTML = '';
    
    if (!currentReturnSale || !currentReturnSale.items) return;

    currentReturnSale.items.forEach(item => {
      const returnedSoFar = item.returned_quantity || 0;
      const availableToReturn = item.quantity - returnedSoFar;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${item.product_name}</td>
        <td>${item.quantity}</td>
        <td>${returnedSoFar}</td>
        <td>
          <input type="number" class="form-input return-qty-input" 
            data-id="${item.id}" 
            data-price="${item.unit_price_paise}"
            data-discount="${item.discount_paise / item.quantity}"
            data-gst="${item.gst_percent}"
            min="0" max="${availableToReturn}" value="${availableToReturn}" 
            oninput="if(typeof BillingModule !== 'undefined') BillingModule.calculatePartialRefund()"
            style="width: 80px;"
            ${availableToReturn === 0 ? 'disabled' : ''}>
        </td>
      `;
      tbody.appendChild(tr);
    });

    calculatePartialRefund();
  }

  function calculatePartialRefund() {
    if (!currentReturnSale) return;

    let refundSubtotalPaise = 0;
    let refundCgstPaise = 0;
    let refundSgstPaise = 0;
    let refundIgstPaise = 0;

    const inputs = document.querySelectorAll('.return-qty-input');
    inputs.forEach(input => {
      const qty = parseInt(input.value) || 0;
      if (qty <= 0) return;

      const unitPrice = parseInt(input.dataset.price) || 0;
      const unitDiscount = parseFloat(input.dataset.discount) || 0;
      const gstPercent = parseFloat(input.dataset.gst) || 0;

      const itemDiscount = Math.round(unitDiscount * qty);
      const lineTotal = Math.max(0, (unitPrice * qty) - itemDiscount);

      let taxableValue = lineTotal;
      let itemGst = 0;
      let cgst = 0, sgst = 0, igst = 0;

      if (gstPercent > 0) {
        taxableValue = Math.round((lineTotal * 100) / (100 + gstPercent));
        itemGst = lineTotal - taxableValue;

        if (currentReturnSale.is_inter_state) {
          igst = itemGst;
        } else {
          cgst = Math.round(itemGst / 2);
          sgst = itemGst - cgst;
        }
      }

      refundSubtotalPaise += taxableValue;
      refundCgstPaise += cgst;
      refundSgstPaise += sgst;
      refundIgstPaise += igst;
    });

    const rawRefundGrandTotal = refundSubtotalPaise + refundCgstPaise + refundSgstPaise + refundIgstPaise;
    
    let finalRefundGrandTotal = rawRefundGrandTotal;
    const appliedCoupon = currentReturnSale.applied_coupon_paise || 0;
    if (appliedCoupon > 0 && currentReturnSale.grand_total_paise > 0) {
      const refundRatio = rawRefundGrandTotal / currentReturnSale.grand_total_paise;
      const couponToRefund = Math.round(appliedCoupon * refundRatio);
      finalRefundGrandTotal -= couponToRefund;
    }

    document.getElementById('return-estimated-refund').textContent = formatRupees(finalRefundGrandTotal);
  }

  async function processReturnSubmit() {
    if (!currentReturnSale) return;
    const receiptNum = currentReturnSale.receipt_number;

    const itemsToReturn = [];
    const inputs = document.querySelectorAll('.return-qty-input');
    inputs.forEach(input => {
      const qty = parseInt(input.value) || 0;
      if (qty > 0) {
        itemsToReturn.push({
          saleItemId: parseInt(input.dataset.id),
          qty: qty
        });
      }
    });

    if (itemsToReturn.length === 0) {
      showToast('No items selected for return', 'warning');
      return;
    }

    try {
      const btn = document.getElementById('btn-submit-return');
      btn.disabled = true;
      btn.textContent = 'Processing...';

      const result = await window.api.billing.processReturn({
        originalReceiptNumber: receiptNum,
        returnItems: itemsToReturn,
        userId: currentUser ? currentUser.id : null,
      });

      if (result.success) {
        showToast(`Return successful. Credit Note: ${result.creditNoteNumber}`, 'success');
        closeModal('modal-process-return');
        document.getElementById('return-receipt-number').value = '';
        document.getElementById('return-items-section').style.display = 'none';
        currentReturnSale = null;
      } else {
        showToast(result.error || 'Return failed', 'error');
      }
      btn.disabled = false;
      btn.textContent = 'Process Return';
    } catch (err) {
      showToast('Connection error', 'error');
      document.getElementById('btn-submit-return').disabled = false;
      document.getElementById('btn-submit-return').textContent = 'Process Return';
    }
  }

  return {
    init,
    fetchSaleForReturn,
    calculatePartialRefund,
    processReturnSubmit
  };
})();
