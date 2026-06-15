// ═══════════════════════════════════════════════════════════════════════════
//  UI/production.js — Production House Intake Module
//  Handles barcode scanning for stock intake: registers new products via
//  a modal, or increments existing product stock by +1.
// ═══════════════════════════════════════════════════════════════════════════

const ProductionModule = (() => {
  // ── DOM References ────────────────────────────────────────────────────
  const scanner       = document.getElementById('production-scanner');
  const flashZone     = document.getElementById('production-flash-zone');
  const activityFeed  = document.getElementById('production-activity-feed');
  const emptyState    = document.getElementById('production-empty-state');

  // Modal references
  const modalOverlay  = document.getElementById('new-product-modal');
  const modalBarcode  = document.getElementById('modal-barcode');
  const modalName     = document.getElementById('modal-product-name');
  const modalPrice    = document.getElementById('modal-product-price');
  const modalQty      = document.getElementById('modal-product-qty');
  const modalSaveBtn  = document.getElementById('modal-save-btn');
  const modalCancelBtn = document.getElementById('modal-cancel-btn');

  let sessionCount = 0;

  // ── Scanner Input Handler ─────────────────────────────────────────────
  scanner.addEventListener('keypress', async (e) => {
    if (e.key !== 'Enter') return;

    const barcode = scanner.value.trim();
    scanner.value = '';

    if (!barcode) return;

    try {
      const product = await window.api.lookupBarcode(barcode);

      if (product) {
        // EXISTING product → Increment stock by +1
        const result = await window.api.incrementStock(barcode);
        if (result.success) {
          showIntakeFlash('existing', result.product);
          addActivityItem(result.product, 'restock');
          window.showToast(
            `<strong>${result.product.name}</strong> → Stock +1 (now ${result.product.stock_quantity})`,
            'success'
          );
        }
      } else {
        // NEW product → Show registration modal
        openNewProductModal(barcode);
      }
    } catch (err) {
      console.error('[Production] Scan error:', err);
      window.showToast('Scan failed — database error', 'error');
    }

    scanner.focus();
  });

  // ── Flash Result Display ──────────────────────────────────────────────
  function showIntakeFlash(type, product) {
    const priceFmt = window.formatRupees(product.price_cents);

    if (type === 'existing') {
      flashZone.innerHTML = `
        <div class="intake-flash existing">
          <span class="flash-icon">✅</span>
          <div class="flash-details">
            <div class="flash-name">${product.name}</div>
            <div class="flash-meta">Stock updated → <strong>${product.stock_quantity} units</strong> · ${priceFmt}</div>
          </div>
        </div>
      `;
    } else {
      flashZone.innerHTML = `
        <div class="intake-flash new-item">
          <span class="flash-icon">🆕</span>
          <div class="flash-details">
            <div class="flash-name">${product.name}</div>
            <div class="flash-meta">New product registered · ${product.stock_quantity} units · ${priceFmt}</div>
          </div>
        </div>
      `;
    }

    // Auto-clear flash after 6 seconds
    setTimeout(() => { flashZone.innerHTML = ''; }, 6000);
  }

  // ── Activity Feed ─────────────────────────────────────────────────────
  function addActivityItem(product, action) {
    if (emptyState) emptyState.remove();

    sessionCount++;
    const priceFmt = window.formatRupees(product.price_cents);
    const icon = action === 'restock' ? '📥' : '🆕';
    const label = action === 'restock' ? 'Restocked +1' : 'New Registration';

    const li = document.createElement('li');
    li.className = 'activity-item';
    li.innerHTML = `
      <div class="item-icon">${icon}</div>
      <div class="item-details">
        <div class="item-name">${product.name}</div>
        <div class="item-meta">${label} · Stock: ${product.stock_quantity} · #${sessionCount}</div>
      </div>
      <div class="item-price">${priceFmt}</div>
    `;

    // Prepend newest item at top
    activityFeed.insertBefore(li, activityFeed.firstChild);
  }

  // ── New Product Modal ─────────────────────────────────────────────────
  function openNewProductModal(barcode) {
    modalBarcode.value = barcode;
    modalName.value = '';
    modalPrice.value = '';
    modalQty.value = '1';

    modalOverlay.classList.add('visible');

    // Focus the product name field after animation
    setTimeout(() => modalName.focus(), 350);
  }

  function closeModal() {
    modalOverlay.classList.remove('visible');
    scanner.focus();
  }

  modalCancelBtn.addEventListener('click', closeModal);

  // Close modal on overlay click (outside the box)
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  // Close modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay.classList.contains('visible')) {
      closeModal();
    }
  });

  modalSaveBtn.addEventListener('click', async () => {
    const barcode = modalBarcode.value.trim();
    const name = modalName.value.trim();
    const priceStr = modalPrice.value.trim();
    const qtyStr = modalQty.value.trim();

    // Validation
    if (!name) {
      window.showToast('Please enter the product name', 'warning');
      modalName.focus();
      return;
    }
    if (!priceStr || isNaN(parseFloat(priceStr)) || parseFloat(priceStr) <= 0) {
      window.showToast('Please enter a valid retail price', 'warning');
      modalPrice.focus();
      return;
    }
    if (!qtyStr || isNaN(parseInt(qtyStr)) || parseInt(qtyStr) < 1) {
      window.showToast('Please enter a valid stock quantity (≥ 1)', 'warning');
      modalQty.focus();
      return;
    }

    const priceCents = window.parseRupeesToPaise(priceStr);
    const stockQuantity = parseInt(qtyStr);

    try {
      const result = await window.api.addNewProduct({ barcode, name, priceCents, stockQuantity });

      if (result.success) {
        const newProduct = { barcode, name, price_cents: priceCents, stock_quantity: stockQuantity };
        showIntakeFlash('new', newProduct);
        addActivityItem(newProduct, 'new');
        window.showToast(`<strong>${name}</strong> registered successfully!`, 'success');
        closeModal();
      } else {
        window.showToast('Failed to save: ' + (result.error || 'Unknown error'), 'error');
      }
    } catch (err) {
      console.error('[Production] Save error:', err);
      window.showToast('Database save failed', 'error');
    }
  });

  // Allow Enter key to submit modal form
  [modalName, modalPrice, modalQty].forEach(input => {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') modalSaveBtn.click();
    });
  });

  // ── Maintain Scanner Autofocus ────────────────────────────────────────
  // Periodically ensure focus when production panel is active
  setInterval(() => {
    const panel = document.getElementById('panel-production');
    if (panel && panel.classList.contains('active') && !modalOverlay.classList.contains('visible')) {
      if (document.activeElement !== scanner) {
        scanner.focus();
      }
    }
  }, 1500);

  return { /* public API if needed */ };
})();
