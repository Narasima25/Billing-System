// ═══════════════════════════════════════════════════════════════════════════
//  UI/retail.js — Retail Billing / Checkout Counter Module
//  Handles scanning items for customer billing, cart management,
//  stock validation, and checkout transaction processing.
// ═══════════════════════════════════════════════════════════════════════════

const RetailModule = (() => {
  // ── DOM References ────────────────────────────────────────────────────
  const scanner       = document.getElementById('retail-scanner');
  const flashZone     = document.getElementById('retail-flash-zone');
  const cartList      = document.getElementById('retail-cart-list');
  const emptyState    = document.getElementById('retail-empty-state');
  const totalDisplay  = document.getElementById('retail-total-display');
  const cancelBtn     = document.getElementById('retail-cancel-btn');
  const checkoutBtn   = document.getElementById('retail-checkout-btn');

  // ── Cart State ────────────────────────────────────────────────────────
  // Each entry: { barcode, name, price_cents, quantity }
  let cart = [];
  let totalCents = 0;

  // ── Scanner Input Handler ─────────────────────────────────────────────
  scanner.addEventListener('keypress', async (e) => {
    if (e.key !== 'Enter') return;

    const barcode = scanner.value.trim();
    scanner.value = '';

    if (!barcode) return;

    // Clear any previous flash messages
    flashZone.innerHTML = '';

    try {
      const product = await window.api.lookupBarcode(barcode);

      if (!product) {
        window.showToast(`Barcode <strong>"${barcode}"</strong> not found in database`, 'error');
        scanner.focus();
        return;
      }

      // Check stock availability
      if (product.stock_quantity <= 0) {
        showOutOfStock(product);
        scanner.focus();
        return;
      }

      // Also check if adding more would exceed stock
      const existingEntry = cart.find(item => item.barcode === barcode);
      if (existingEntry && existingEntry.quantity >= product.stock_quantity) {
        showOutOfStock(product, true);
        scanner.focus();
        return;
      }

      // Add to cart
      addToCart(product);
      window.showToast(`Added <strong>${product.name}</strong> to cart`, 'success');

    } catch (err) {
      console.error('[Retail] Scan error:', err);
      window.showToast('Scan failed — database error', 'error');
    }

    scanner.focus();
  });

  // ── Add to Cart ───────────────────────────────────────────────────────
  function addToCart(product) {
    const existingIndex = cart.findIndex(item => item.barcode === product.barcode);

    if (existingIndex >= 0) {
      // Increment quantity of existing cart entry
      cart[existingIndex].quantity += 1;
    } else {
      // Add new entry
      cart.push({
        barcode: product.barcode,
        name: product.name,
        price_cents: product.price_cents,
        quantity: 1,
      });
    }

    totalCents += product.price_cents;
    renderCart();
  }

  // ── Render Cart UI ────────────────────────────────────────────────────
  function renderCart() {
    if (cart.length === 0) {
      cartList.innerHTML = `
        <li class="empty-state" id="retail-empty-state">
          <span class="empty-icon">🛍️</span>
          <p>Cart is empty.<br>Scan items to start billing.</p>
        </li>
      `;
      totalDisplay.textContent = '₹0.00';
      return;
    }

    cartList.innerHTML = '';

    cart.forEach((item, index) => {
      const lineTotal = item.price_cents * item.quantity;
      const li = document.createElement('li');
      li.className = 'cart-item';
      li.innerHTML = `
        <div class="ci-info">
          <span class="ci-name">${item.name}</span>
          <span class="ci-barcode">${item.barcode}</span>
        </div>
        <span class="ci-qty">×${item.quantity}</span>
        <span class="ci-price">${window.formatRupees(lineTotal)}</span>
      `;
      cartList.appendChild(li);
    });

    totalDisplay.textContent = window.formatRupees(totalCents);
  }

  // ── Out of Stock Alert ────────────────────────────────────────────────
  function showOutOfStock(product, cartLimit = false) {
    const msg = cartLimit
      ? `Cannot add more — only <strong>${product.stock_quantity}</strong> units available for <strong>${product.name}</strong>`
      : `<strong>${product.name}</strong> is <strong>Out of Stock!</strong> (0 units remaining)`;

    flashZone.innerHTML = `
      <div class="oos-alert">
        <span>🚫</span>
        <span>${msg}</span>
      </div>
    `;

    window.showToast('Out of Stock! Cannot add to bill.', 'warning');

    // Auto-clear after 4 seconds
    setTimeout(() => { flashZone.innerHTML = ''; }, 4000);
  }

  // ── Cancel / Clear Cart ───────────────────────────────────────────────
  cancelBtn.addEventListener('click', () => {
    if (cart.length === 0) {
      window.showToast('Cart is already empty', 'info');
      scanner.focus();
      return;
    }

    // Confirm before clearing
    if (confirm('Cancel this transaction and clear all items from the cart?')) {
      cart = [];
      totalCents = 0;
      renderCart();
      flashZone.innerHTML = '';
      window.showToast('Cart cleared', 'info');
    }

    scanner.focus();
  });

  // ── Complete Checkout ─────────────────────────────────────────────────
  checkoutBtn.addEventListener('click', async () => {
    if (cart.length === 0) {
      window.showToast('Cart is empty — scan items first', 'warning');
      scanner.focus();
      return;
    }

    // Build cart items payload for IPC
    const cartItems = cart.map(item => ({
      barcode: item.barcode,
      quantity: item.quantity,
    }));

    try {
      const result = await window.api.checkoutCart(cartItems);

      if (result.success) {
        const totalFmt = window.formatRupees(result.totalCents);
        window.showToast(
          `Sale complete! Receipt <strong>${result.receiptNumber}</strong> — ${totalFmt}`,
          'success'
        );

        // Reset cart
        cart = [];
        totalCents = 0;
        renderCart();
        flashZone.innerHTML = '';
      } else {
        window.showToast('Checkout failed: ' + (result.error || 'Unknown error'), 'error');
      }
    } catch (err) {
      console.error('[Retail] Checkout error:', err);
      window.showToast('Checkout transaction failed', 'error');
    }

    scanner.focus();
  });

  // ── Maintain Scanner Autofocus ────────────────────────────────────────
  setInterval(() => {
    const panel = document.getElementById('panel-retail');
    if (panel && panel.classList.contains('active')) {
      if (document.activeElement !== scanner && !document.activeElement.closest('.btn')) {
        scanner.focus();
      }
    }
  }, 1500);

  return { /* public API if needed */ };
})();
