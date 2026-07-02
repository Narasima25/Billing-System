// ═══════════════════════════════════════════════════════════════════════════
//  UI/products.js — Product Master Module
//  Full CRUD for products with search, pagination, category/supplier filters.
// ═══════════════════════════════════════════════════════════════════════════

const ProductsModule = (() => {
  const panel = document.getElementById('panel-products');
  let initialized = false;
  let currentPage = 1;
  const perPage = 20;
  let currentSearch = '';
  let currentCategory = '';

  function init() {
    if (!initialized) {
      render();
      bindEvents();
      initialized = true;
    }
    loadProducts();
    loadDropdowns();
  }

  function render() {
    panel.innerHTML = `
      <div class="page-toolbar">
        <div>
          <h2 style="font-size:20px;font-weight:800;margin-bottom:4px;">🏷️ Product Master</h2>
          <p class="text-muted text-sm">Manage your product catalog</p>
        </div>
        <div class="btn-group">
          <button class="btn btn-primary" id="btn-add-product">+ Add Product</button>
          <button class="btn btn-secondary" id="btn-manage-categories">📁 Categories</button>
        </div>
      </div>

      <div class="table-toolbar">
        <div class="search-box">
          <input type="text" id="products-search" placeholder="Search by name, barcode, or brand...">
        </div>
        <select class="form-select" id="products-category-filter" style="width:180px;padding:9px 12px;font-size:13px;">
          <option value="">All Categories</option>
        </select>
      </div>

      <div class="card" style="padding:0;">
        <div class="data-table-wrap" style="max-height:calc(100vh - 280px);">
          <table class="data-table" id="products-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Barcode</th>
                <th>Category</th>
                <th>HSN</th>
                <th>Purchase ₹</th>
                <th>Selling ₹</th>
                <th>GST%</th>
                <th>Stock</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="products-tbody">
              <tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-muted);">Loading...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="pagination" id="products-pagination"></div>

      <!-- Categories Sub-Modal -->
      <div class="modal-overlay" id="modal-categories-list">
        <div class="modal-box">
          <div class="modal-header">
            <div class="modal-title">📁 Manage Categories</div>
            <button class="modal-close" onclick="closeModal('modal-categories-list')">✕</button>
          </div>
          <button class="btn btn-primary btn-sm mb-16" id="btn-add-cat-inline">+ Add Category</button>
          <div id="categories-list-content"></div>
        </div>
      </div>
    `;
  }

  function bindEvents() {
    // Search
    let searchTimer;
    document.getElementById('products-search').addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        currentSearch = e.target.value.trim();
        currentPage = 1;
        loadProducts();
      }, 300);
    });

    // Category filter
    document.getElementById('products-category-filter').addEventListener('change', (e) => {
      currentCategory = e.target.value;
      currentPage = 1;
      loadProducts();
    });

    // Save product
    document.getElementById('btn-save-product').addEventListener('click', saveProduct);
    document.getElementById('form-product').addEventListener('submit', (e) => { e.preventDefault(); saveProduct(); });

    // Manage categories
    document.getElementById('btn-manage-categories').addEventListener('click', () => {
      openModal('modal-categories-list');
      loadCategoriesList();
    });

    // Add product
    document.getElementById('btn-add-product').addEventListener('click', () => {
      openProductModal();
    });

    // Save category
    document.getElementById('btn-save-category').addEventListener('click', saveCategory);
    document.getElementById('form-category').addEventListener('submit', (e) => { e.preventDefault(); saveCategory(); });

    document.getElementById('btn-add-cat-inline').addEventListener('click', () => {
      openCategoryModal();
    });

    // Table actions (delegated)
    document.getElementById('products-tbody').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const id = parseInt(btn.dataset.id);
      if (btn.dataset.action === 'edit') editProduct(id);
      if (btn.dataset.action === 'delete') deleteProduct(id);
      if (btn.dataset.action === 'adjust') openStockAdjustModal(id, btn.dataset.name);
    });

    // Pagination
    document.getElementById('products-pagination').addEventListener('click', (e) => {
      const btn = e.target.closest('.page-btn');
      if (!btn || btn.classList.contains('active')) return;
      currentPage = parseInt(btn.dataset.page);
      loadProducts();
    });

    // Auto-calculate Final Purchase Price
    const calcFinalPrice = () => {
      const base = parseFloat(document.getElementById('prod-base-price').value) || 0;
      const disc = parseFloat(document.getElementById('prod-scheme-disc').value) || 0;
      const finalPrice = Math.max(0, base - disc);
      document.getElementById('prod-purchase-price').value = finalPrice.toFixed(2);
    };
    document.getElementById('prod-base-price').addEventListener('input', calcFinalPrice);
    document.getElementById('prod-scheme-disc').addEventListener('input', calcFinalPrice);
  }

  async function loadDropdowns() {
    const categories = await window.api.categories.getAll();
    const suppliers = await window.api.suppliers.getAll();

    // Product modal dropdowns
    const catSelect = document.getElementById('prod-category');
    const catFilter = document.getElementById('products-category-filter');
    const supSelect = document.getElementById('prod-supplier');

    catSelect.innerHTML = '<option value="">— Select —</option>' +
      categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    catFilter.innerHTML = '<option value="">All Categories</option>' +
      categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    supSelect.innerHTML = '<option value="">— Select —</option>' +
      suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  }

  async function loadProducts() {
    const tbody = document.getElementById('products-tbody');
    try {
      const result = await window.api.products.getAll({
        search: currentSearch,
        categoryId: currentCategory ? parseInt(currentCategory) : null,
        page: currentPage,
        perPage,
      });

      if (result.products.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-muted);">
          ${currentSearch ? 'No products match your search' : 'No products yet — add your first product'}</td></tr>`;
        document.getElementById('products-pagination').innerHTML = '';
        return;
      }

      tbody.innerHTML = result.products.map(p => {
        let stockClass = 'ok';
        if (p.stock_quantity === 0) stockClass = 'critical';
        else if (p.stock_quantity <= p.minimum_stock_level) stockClass = 'low';

        return `<tr>
          <td>
            <div class="fw-700">${p.product_name}</div>
            ${p.brand ? `<div class="text-sm text-muted">${p.brand}</div>` : ''}
          </td>
          <td><span class="font-mono text-sm">${p.barcode}</span></td>
          <td>${p.category_name ? `<span class="badge badge-teal">${p.category_name}</span>` : '<span class="text-muted">—</span>'}</td>
          <td><span class="font-mono text-sm">${p.hsn_code || '—'}</span></td>
          <td>${formatRupees(p.purchase_price_paise)}</td>
          <td class="fw-700">${formatRupees(p.selling_price_paise)}</td>
          <td>${p.gst_percent || 0}%</td>
          <td><span class="stock-badge ${stockClass}">${p.stock_quantity}</span></td>
          <td>
            <div class="btn-group" style="gap:4px;">
              <button class="btn btn-ghost btn-sm" data-action="edit" data-id="${p.id}" title="Edit">✏️</button>
              <button class="btn btn-ghost btn-sm" data-action="adjust" data-id="${p.id}" data-name="${p.product_name}" title="Adjust Stock">📦</button>
              <button class="btn btn-ghost btn-sm" data-action="delete" data-id="${p.id}" title="Delete">🗑️</button>
            </div>
          </td>
        </tr>`;
      }).join('');

      // Pagination
      renderPagination(result.total, result.page, result.perPage);
    } catch (err) {
      console.error('[Products] load error:', err);
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--accent-rose);">Error loading products</td></tr>';
    }
  }

  function renderPagination(total, page, pp) {
    const totalPages = Math.ceil(total / pp);
    const pgDiv = document.getElementById('products-pagination');
    if (totalPages <= 1) { pgDiv.innerHTML = ''; return; }

    let html = '';
    if (page > 1) html += `<button class="page-btn" data-page="${page - 1}">← Prev</button>`;
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= page - 2 && i <= page + 2)) {
        html += `<button class="page-btn ${i === page ? 'active' : ''}" data-page="${i}">${i}</button>`;
      } else if (i === page - 3 || i === page + 3) {
        html += `<span class="page-info">...</span>`;
      }
    }
    if (page < totalPages) html += `<button class="page-btn" data-page="${page + 1}">Next →</button>`;
    pgDiv.innerHTML = html;
  }

  function openProductModal(product = null) {
    document.getElementById('modal-product-title').textContent = product ? '✏️ Edit Product' : '🏷️ Add Product';
    document.getElementById('product-edit-id').value = product ? product.id : '';
    document.getElementById('prod-barcode').value = product ? product.barcode : '';
    document.getElementById('prod-barcode').readOnly = !!product;
    document.getElementById('prod-name').value = product ? product.product_name : '';
    document.getElementById('prod-category').value = product ? (product.category_id || '') : '';
    document.getElementById('prod-brand').value = product ? (product.brand || '') : '';
    document.getElementById('prod-supplier').value = product ? (product.supplier_id || '') : '';
    document.getElementById('prod-base-price').value = product ? (product.base_price_paise / 100).toFixed(2) : '';
    document.getElementById('prod-scheme-disc').value = product ? (product.scheme_discount_paise / 100).toFixed(2) : '';
    document.getElementById('prod-purchase-price').value = product ? (product.purchase_price_paise / 100).toFixed(2) : '';
    document.getElementById('prod-selling-price').value = product ? (product.selling_price_paise / 100).toFixed(2) : '';
    document.getElementById('prod-gst').value = product ? (product.gst_percent || '') : '18';
    document.getElementById('prod-hsn').value = product ? (product.hsn_code || '') : '';
    document.getElementById('prod-stock').value = product ? '' : '0';
    document.getElementById('prod-stock').disabled = !!product;
    document.getElementById('prod-min-stock').value = product ? product.minimum_stock_level : '5';
    document.getElementById('prod-desc').value = product ? (product.description || '') : '';

    loadDropdowns();
    openModal('modal-product');
    setTimeout(() => document.getElementById(product ? 'prod-name' : 'prod-barcode').focus(), 350);
  }

  async function saveProduct() {
    const editId = document.getElementById('product-edit-id').value;
    const minStockVal = document.getElementById('prod-min-stock').value;
    const stockVal = document.getElementById('prod-stock').value;
    const gstVal = document.getElementById('prod-gst').value;

    const data = {
      barcode: document.getElementById('prod-barcode').value.trim(),
      productName: document.getElementById('prod-name').value.trim(),
      categoryId: document.getElementById('prod-category').value || null,
      brand: document.getElementById('prod-brand').value.trim(),
      supplierId: document.getElementById('prod-supplier').value || null,
      basePricePaise: parseRupeesToPaise(document.getElementById('prod-base-price').value),
      schemeDiscountPaise: parseRupeesToPaise(document.getElementById('prod-scheme-disc').value),
      purchasePricePaise: parseRupeesToPaise(document.getElementById('prod-purchase-price').value),
      sellingPricePaise: parseRupeesToPaise(document.getElementById('prod-selling-price').value),
      gstPercent: gstVal !== '' ? parseFloat(gstVal) : 0,
      hsnCode: document.getElementById('prod-hsn').value.trim(),
      stockQuantity: stockVal !== '' ? parseInt(stockVal) : 0,
      minimumStockLevel: minStockVal !== '' ? parseInt(minStockVal) : 5,
      description: document.getElementById('prod-desc').value.trim(),
    };

    if (!data.barcode) { showToast('Barcode is required', 'warning'); return; }
    if (!data.productName) { showToast('Product name is required', 'warning'); return; }
    if (data.sellingPricePaise <= 0) { showToast('Selling price is required', 'warning'); return; }

    try {
      let result;
      if (editId) {
        data.id = parseInt(editId);
        result = await window.api.products.update(data);
      } else {
        result = await window.api.products.add(data);
      }

      if (result.success) {
        closeModal('modal-product');
        loadProducts();
        showToast(editId ? 'Product updated' : 'Product added successfully', 'success');
      } else {
        showToast(result.error || 'Save failed', 'error');
      }
    } catch (err) {
      showToast('Save error', 'error');
    }
  }

  async function editProduct(id) {
    const result = await window.api.products.getAll({ search: '', page: 1, perPage: 50000 });
    const product = result.products.find(p => p.id === id);
    if (product) {
      openProductModal(product);
    }
  }

  async function deleteProduct(id) {
    if (!confirm('Are you sure you want to delete this product?')) return;
    const result = await window.api.products.delete(id);
    if (result.success) { loadProducts(); showToast('Product deleted', 'success'); }
    else showToast(result.error || 'Delete failed', 'error');
  }

  function openStockAdjustModal(id, name) {
    document.getElementById('adjust-product-id').value = id;
    document.getElementById('adjust-product-name').value = name;
    document.getElementById('adjust-type').value = 'add';
    document.getElementById('adjust-qty').value = '';
    document.getElementById('adjust-reason').value = '';
    openModal('modal-stock-adjust');
  }

  // ─── Categories Management ─────────────────────────────────────────────
  async function loadCategoriesList() {
    const categories = await window.api.categories.getAll();
    const div = document.getElementById('categories-list-content');
    if (categories.length === 0) {
      div.innerHTML = '<p class="text-muted">No categories yet</p>';
      return;
    }
    div.innerHTML = `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>Name</th><th>Description</th><th>Actions</th></tr></thead><tbody>${
      categories.map(c => `<tr>
        <td class="fw-700">${c.name}</td>
        <td class="text-muted">${c.description || '—'}</td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="ProductsModule._editCat(${c.id},'${c.name.replace(/'/g,"\\'")}','${(c.description||'').replace(/'/g,"\\'")}')">✏️</button>
          <button class="btn btn-ghost btn-sm" onclick="ProductsModule._deleteCat(${c.id})">🗑️</button>
        </td>
      </tr>`).join('')
    }</tbody></table></div>`;
  }

  function openCategoryModal(cat = null) {
    document.getElementById('modal-category-title').textContent = cat ? '✏️ Edit Category' : '📁 Add Category';
    document.getElementById('category-edit-id').value = cat ? cat.id : '';
    document.getElementById('cat-name').value = cat ? cat.name : '';
    document.getElementById('cat-desc').value = cat ? (cat.description || '') : '';
    openModal('modal-category');
  }

  async function saveCategory() {
    const editId = document.getElementById('category-edit-id').value;
    const name = document.getElementById('cat-name').value.trim();
    const description = document.getElementById('cat-desc').value.trim();
    if (!name) { showToast('Category name is required', 'warning'); return; }

    try {
      let result;
      if (editId) {
        result = await window.api.categories.update({ id: parseInt(editId), name, description });
      } else {
        result = await window.api.categories.add({ name, description });
      }
      if (result.success) {
        closeModal('modal-category');
        loadCategoriesList();
        loadDropdowns();
        showToast(editId ? 'Category updated' : 'Category added', 'success');
      } else {
        showToast(result.error || 'Save failed', 'error');
      }
    } catch (err) {
      showToast('Save error', 'error');
    }
  }

  return {
    init,
    _editCat: (id, name, desc) => openCategoryModal({ id, name, description: desc }),
    _deleteCat: async (id) => {
      if (!confirm('Delete this category?')) return;
      const r = await window.api.categories.delete(id);
      if (r.success) { loadCategoriesList(); loadDropdowns(); showToast('Category deleted', 'success'); }
      else showToast(r.error || 'Cannot delete', 'error');
    },
  };
})();
