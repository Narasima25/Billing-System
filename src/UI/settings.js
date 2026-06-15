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
          <!-- Store Information -->
          <div class="settings-section">
            <h3>🏪 Store Information</h3>
            <div class="form-group">
              <label class="form-label">Store Name</label>
              <input type="text" class="form-input" id="set-store-name" placeholder="Your Store Name">
            </div>
            <div class="form-group">
              <label class="form-label">Store Address</label>
              <input type="text" class="form-input" id="set-store-address" placeholder="Full address">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Phone</label>
                <input type="text" class="form-input" id="set-store-phone" placeholder="+91 XXXXXXXXXX">
              </div>
              <div class="form-group">
                <label class="form-label">GST Number</label>
                <input type="text" class="form-input" id="set-store-gst" placeholder="GSTIN">
              </div>
            </div>
            <button class="btn btn-primary btn-sm mt-8" id="btn-save-store-info">Save Store Info</button>
          </div>

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

          ${isAdmin ? `
          <!-- User Management -->
          <div class="settings-section">
            <h3>🔐 User Management</h3>
            <button class="btn btn-primary btn-sm mb-16" id="btn-add-user-settings">+ Add User</button>
            <div id="users-list-content"></div>
          </div>
          ` : ''}

          <!-- About -->
          <div class="settings-section">
            <h3>ℹ️ About</h3>
            <div class="text-sm" style="line-height:2;">
              <strong>Pet Store POS System</strong><br>
              Version 1.0.0<br>
              Built with Electron.js + SQL.js<br>
              All data stored locally in SQLite<br>
              Currency: Indian Rupees (₹)
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function bindEvents() {
    // Save store info
    panel.addEventListener('click', (e) => {
      if (e.target.id === 'btn-save-store-info') saveStoreInfo();
      if (e.target.id === 'btn-test-print') testPrint();
      if (e.target.id === 'toggle-dark-mode') toggleDarkMode();
      if (e.target.id === 'btn-backup-export') exportBackup();
      if (e.target.id === 'btn-backup-import') importBackup();
      if (e.target.id === 'btn-add-user-settings') openUserModal();
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
      document.getElementById('set-store-name').value = settings.store_name || '';
      document.getElementById('set-store-address').value = settings.store_address || '';
      document.getElementById('set-store-phone').value = settings.store_phone || '';
      document.getElementById('set-store-gst').value = settings.store_gst || '';
      document.getElementById('set-printer-width').value = settings.printer_width || '80';

      const lastBackup = settings.last_backup;
      document.getElementById('set-last-backup').textContent = lastBackup ? formatDate(lastBackup) : 'Never';

      // Dark mode
      const isDark = settings.theme === 'dark';
      document.body.classList.toggle('dark', isDark);
      const toggle = document.getElementById('toggle-dark-mode');
      if (toggle) toggle.classList.toggle('on', isDark);
    } catch (err) {
      console.error('[Settings] load error:', err);
    }
  }

  async function saveStoreInfo() {
    try {
      await window.api.settings.set({ key: 'store_name', value: document.getElementById('set-store-name').value.trim() });
      await window.api.settings.set({ key: 'store_address', value: document.getElementById('set-store-address').value.trim() });
      await window.api.settings.set({ key: 'store_phone', value: document.getElementById('set-store-phone').value.trim() });
      await window.api.settings.set({ key: 'store_gst', value: document.getElementById('set-store-gst').value.trim() });
      showToast('Store information saved', 'success');
    } catch (err) {
      showToast('Failed to save settings', 'error');
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

  function testPrint() {
    const container = document.getElementById('receipt-container');
    container.innerHTML = `
      <div class="r-center r-bold" style="font-size:16px;">PRINTER TEST</div>
      <div class="r-line"></div>
      <div class="r-center">If you can read this, your thermal printer is configured correctly.</div>
      <div class="r-line"></div>
      <div class="r-center">🐾 Pet Store POS 🐾</div>
    `;
    window.print();
    showToast('Test print sent', 'info');
  }

  async function exportBackup() {
    try {
      const result = await window.api.backup.export();
      if (result.success) {
        // Download as file
        const blob = new Blob([result.data], { type: 'application/octet-stream' });
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
    document.getElementById('user-username').readOnly = !!user;
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
          id: parseInt(editId), displayName, role,
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
