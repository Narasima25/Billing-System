// ═══════════════════════════════════════════════════════════════════════════
//  UI/settings.js — Settings Module
//  Store config, theme toggle, user management, printer settings, backup.
// ═══════════════════════════════════════════════════════════════════════════

const SettingsModule = (() => {
  const panel = document.getElementById('panel-settings');
  let initialized = false;

  function init() {
    if (!initialized) {
      render();
      bindEvents();
      initialized = true;
    }
    loadSettings();
    if (currentUser && currentUser.role === 'admin') loadUsers();
  }

  function render() {
    const isAdmin = currentUser && currentUser.role === 'admin';

    panel.innerHTML = `
      <div class="section-header">
        <h2>⚙️ Settings</h2>
        <p>Store configuration, appearance, and system management</p>
      </div>

      <div class="grid-2">
        <!-- Left Column -->
        <div>
          ${isAdmin ? `
          <!-- User Management -->
          <div class="settings-section">
            <h3>🔐 User Management</h3>
            <button class="btn btn-primary btn-sm mb-16" id="btn-add-user-settings">+ Add User</button>
            <div id="users-list-content"></div>
          </div>
          ` : ''}

          <!-- Printer Settings -->
          <div class="settings-section">
            <h3>🖨️ Printer Configuration</h3>
            <div class="form-group">
              <label class="form-label">Thermal Printer Width</label>
              <select class="form-select" id="set-printer-width">
                <option value="58">58mm (32 characters)</option>
                <option value="80">80mm (48 characters)</option>
              </select>
            </div>
            <button class="btn btn-secondary btn-sm" id="btn-test-print">🖨️ Test Print</button>
          </div>

          <!-- Appearance -->
          <div class="settings-section">
            <h3>🎨 Appearance</h3>
            <div class="toggle-wrap">
              <div>
                <div class="toggle-label">Dark Mode</div>
                <div class="toggle-desc">Switch to dark theme for low-light environments</div>
              </div>
              <button class="toggle" id="toggle-dark-mode" type="button"></button>
            </div>
          </div>
        </div>

        <!-- Right Column -->
        <div>
          <!-- Store Configuration -->
          <div class="settings-section">
            <h3>🏬 Store Configuration</h3>
            <p class="text-sm text-muted mb-16">Configure your shop's details, GST, and UPI.</p>
            <div class="form-group">
              <label class="form-label">Store Name</label>
              <input type="text" class="form-input" id="set-store-name" placeholder="e.g. SKY PETS">
            </div>
            <div class="form-group">
              <label class="form-label">Store Address</label>
              <input type="text" class="form-input" id="set-store-address" placeholder="Store address...">
            </div>
            <div class="form-group">
              <label class="form-label">Store Phone</label>
              <input type="text" class="form-input" id="set-store-phone" placeholder="Phone number...">
            </div>
            <div class="form-group">
              <label class="form-label">Shop GSTIN</label>
              <input type="text" class="form-input" id="set-shop-gstin" placeholder="15-digit GSTIN" maxlength="15">
            </div>
            <div class="form-group">
              <label class="form-label">Store UPI ID</label>
              <input type="text" class="form-input" id="set-shop-upi-id" placeholder="e.g. storename@upi" autocomplete="off">
            </div>
            <div class="form-group">
              <label class="form-label">Shop State Code *</label>
              <select class="form-select" id="set-shop-state-code">
                <option value="">-- Select State --</option>
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
            <button class="btn btn-primary btn-sm" id="btn-save-store-config">✔ Save Store Config</button>
          </div>

          <!-- Cloud Backup -->
          <div class="settings-section">
            <h3>☁️ Cloud Backup</h3>
            <p class="text-sm text-muted mb-16">Export and restore your database. Cloud sync with Google Drive or AWS S3 can be configured with API credentials.</p>
            <div class="form-group">
              <label class="form-label">Last Backup</label>
              <div id="set-last-backup" class="text-sm text-muted">Never</div>
            </div>
            <div class="btn-group">
              <button class="btn btn-primary btn-sm" id="btn-backup-export">📤 Export Backup</button>
              <button class="btn btn-secondary btn-sm" id="btn-backup-import">📥 Import Backup</button>
            </div>
          </div>

        </div>
      </div>
    `;
  }

  function bindEvents() {
    // Settings panel click events
    panel.addEventListener('click', (e) => {
      if (e.target.id === 'btn-test-print') testPrint();
      if (e.target.id === 'toggle-dark-mode') toggleDarkMode();
      if (e.target.id === 'btn-backup-export') exportBackup();
      if (e.target.id === 'btn-backup-import') importBackup();
      if (e.target.id === 'btn-add-user-settings') openUserModal();
      if (e.target.id === 'btn-save-store-config') saveStoreConfig();
    });

    // Printer width change
    panel.addEventListener('change', async (e) => {
      if (e.target.id === 'set-printer-width') {
        await window.api.settings.set({ key: 'printer_width', value: e.target.value });
        showToast('Printer width updated', 'success');
      }
    });

    // User form save
    document.getElementById('btn-save-user').addEventListener('click', saveUser);
    document.getElementById('form-user').addEventListener('submit', (e) => { e.preventDefault(); saveUser(); });
  }

  async function loadSettings() {
    try {
      const settings = await window.api.settings.getAll();
      document.getElementById('set-printer-width').value = settings.printer_width || '80';

      const lastBackup = settings.last_backup;
      document.getElementById('set-last-backup').textContent = lastBackup ? formatDate(lastBackup) : 'Never';

      // Dark mode
      const isDark = settings.theme === 'dark';
      document.body.classList.toggle('dark', isDark);
      const toggle = document.getElementById('toggle-dark-mode');
      if (toggle) toggle.classList.toggle('on', isDark);

      // Store & GST Config
      document.getElementById('set-store-name').value = settings.store_name || '';
      document.getElementById('set-store-address').value = settings.store_address || '';
      document.getElementById('set-store-phone').value = settings.store_phone || '';
      document.getElementById('set-shop-gstin').value = settings.shop_gstin || '';
      document.getElementById('set-shop-upi-id').value = settings.shop_upi_id || '';
      document.getElementById('set-shop-state-code').value = settings.shop_state_code || '';
    } catch (err) {
      console.error('[Settings] load error:', err);
    }
  }

  async function toggleDarkMode() {
    const isDark = !document.body.classList.contains('dark');
    document.body.classList.toggle('dark', isDark);
    const toggle = document.getElementById('toggle-dark-mode');
    if (toggle) toggle.classList.toggle('on', isDark);
    await window.api.settings.set({ key: 'theme', value: isDark ? 'dark' : 'light' });
    showToast(isDark ? 'Dark mode enabled' : 'Light mode enabled', 'info');
  }

  async function saveStoreConfig() {
    const storeName = document.getElementById('set-store-name').value.trim();
    const storeAddress = document.getElementById('set-store-address').value.trim();
    const storePhone = document.getElementById('set-store-phone').value.trim();
    const gstin = document.getElementById('set-shop-gstin').value.trim();
    const stateCode = document.getElementById('set-shop-state-code').value;
    const upiId = document.getElementById('set-shop-upi-id').value.trim();

    if (!stateCode) {
      showToast('Please select a State Code', 'warning');
      return;
    }

    try {
      await window.api.settings.set({ key: 'store_name', value: storeName });
      await window.api.settings.set({ key: 'store_address', value: storeAddress });
      await window.api.settings.set({ key: 'store_phone', value: storePhone });
      await window.api.settings.set({ key: 'shop_gstin', value: gstin });
      await window.api.settings.set({ key: 'shop_state_code', value: stateCode });
      await window.api.settings.set({ key: 'shop_upi_id', value: upiId });
      showToast('Store Configuration saved', 'success');
    } catch (err) {
      showToast('Failed to save Store config', 'error');
    }
  }

  function testPrint() {
    const container = document.getElementById('receipt-container');
    container.innerHTML = `
      <div class="r-center r-bold" style="font-size:16px;">PRINTER TEST</div>
      <div class="r-line"></div>
      <div class="r-center">If you can read this, your thermal printer is configured correctly.</div>
      <div class="r-center">🐾 SKY PETS 🐾</div>
    `;
    window.print();
    showToast('Test print sent', 'info');
  }

  async function exportBackup() {
    try {
      const result = await window.api.backup.export();
      if (result.success) {
        // Convert base64 to proper binary Blob
        const res = await fetch(`data:application/octet-stream;base64,${result.data}`);
        const blob = await res.blob();
        
        // Download as file
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `petstore-backup-${getToday()}.bak`;
        a.click();
        URL.revokeObjectURL(url);

        document.getElementById('set-last-backup').textContent = formatDate(new Date().toISOString());
        showToast(`Backup exported (${(result.size / 1024).toFixed(1)} KB)`, 'success');
      } else {
        showToast(result.error || 'Backup failed', 'error');
      }
    } catch (err) {
      showToast('Backup error', 'error');
    }
  }

  function importBackup() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.bak,.db';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!confirm('This will REPLACE your current database. Are you sure?')) return;

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result.split(',')[1] || reader.result;
          const result = await window.api.backup.import(base64);
          if (result.success) {
            showToast('Database restored! Restarting...', 'success');
            setTimeout(() => location.reload(), 2000);
          } else {
            showToast(result.error || 'Import failed', 'error');
          }
        } catch (err) {
          showToast('Import error', 'error');
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  // ─── User Management ──────────────────────────────────────────────────
  async function loadUsers() {
    const div = document.getElementById('users-list-content');
    if (!div) return;
    try {
      const users = await window.api.auth.getUsers();
      if (users.length === 0) {
        div.innerHTML = '<p class="text-muted text-sm">No users</p>';
        return;
      }
      div.innerHTML = users.map(u => {
        const roleColors = { admin: 'badge-rose', manager: 'badge-amber', cashier: 'badge-teal' };
        return `<div class="list-item">
          <div class="li-icon" style="background:var(--accent-teal-dim);">
            ${u.display_name.charAt(0).toUpperCase()}
          </div>
          <div class="li-content">
            <div class="li-title">${u.display_name} <span class="badge ${roleColors[u.role] || 'badge-teal'}">${u.role}</span></div>
            <div class="li-meta">@${u.username} · ${u.is_active ? 'Active' : 'Inactive'}</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="SettingsModule._editUser(${u.id})">✏️</button>
        </div>`;
      }).join('');
    } catch (err) {
      div.innerHTML = '<p class="text-muted">Error loading users</p>';
    }
  }

  function openUserModal(user = null) {
    document.getElementById('modal-user-title').textContent = user ? '✏️ Edit User' : '🔐 Add User';
    document.getElementById('user-edit-id').value = user ? user.id : '';
    document.getElementById('user-username').value = user ? user.username : '';
    document.getElementById('user-displayname').value = user ? user.display_name : '';
    document.getElementById('user-password').value = '';
    document.getElementById('user-password').placeholder = user ? 'Leave blank to keep current' : 'Set password';
    document.getElementById('user-role').value = user ? user.role : 'cashier';
    openModal('modal-user');
  }

  async function saveUser() {
    const editId = document.getElementById('user-edit-id').value;
    const username = document.getElementById('user-username').value.trim();
    const displayName = document.getElementById('user-displayname').value.trim();
    const password = document.getElementById('user-password').value;
    const role = document.getElementById('user-role').value;

    if (!username || !displayName) { showToast('Username and display name required', 'warning'); return; }
    if (!editId && !password) { showToast('Password is required for new users', 'warning'); return; }

    try {
      let result;
      if (editId) {
        result = await window.api.auth.updateUser({
          id: parseInt(editId), username, displayName, role,
          password: password || null, isActive: true,
        });
      } else {
        result = await window.api.auth.createUser({ username, password, displayName, role });
      }

      if (result.success) {
        closeModal('modal-user');
        loadUsers();
        showToast(editId ? 'User updated' : 'User created', 'success');
      } else {
        showToast(result.error || 'Save failed', 'error');
      }
    } catch (err) {
      showToast('Save error', 'error');
    }
  }

  return {
    init,
    _editUser: async (id) => {
      const users = await window.api.auth.getUsers();
      const user = users.find(u => u.id === id);
      if (user) openUserModal(user);
    },
  };
})();
