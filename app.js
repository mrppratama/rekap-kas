/**
 * REKAP KAS KELAS - CORE APPLICATION SCRIPT
 * Ultra-lightweight, 100% Offline, Pure Vanilla JS + IndexedDB
 */

(() => {
  'use strict';

  // ==========================================
  // 1. CONSTANTS & CONFIGURATION
  // ==========================================
  const DB_NAME = 'RekapKasDB';
  const DB_VERSION = 1;
  const DEFAULT_CATEGORIES = [
    'Konsumsi',
    'Honor',
    'Kegiatan',
    'Perlengkapan',
    'Transportasi',
    'Lainnya'
  ];

  // Default months for Indonesian calendar
  const MONTHS_ID = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  // ==========================================
  // LAZY VENDOR LOADER
  // ==========================================
  const _loadedScripts = new Set();
  function lazyLoadScript(src) {
    if (_loadedScripts.has(src)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload  = () => { _loadedScripts.add(src); resolve(); };
      s.onerror = () => reject(new Error('Failed to load: ' + src));
      document.head.appendChild(s);
    });
  }

  async function ensureJsPDF() {
    if (window.jspdf && window.jspdf.jsPDF) return;
    await lazyLoadScript('vendor/jspdf.umd.min.js');
    await lazyLoadScript('vendor/jspdf.plugin.autotable.min.js');
  }

  async function ensureXLSX() {
    if (window.XLSX) return;
    await lazyLoadScript('vendor/xlsx.mini.min.js');
  }

  // ==========================================
  // DEBOUNCE HELPER
  // ==========================================
  function debounce(fn, delay = 280) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  // ==========================================
  // CUSTOM SELECT UI ENGINE
  // Replaces default browser dropdown popup with clean custom UI
  // ==========================================
  // ==========================================
  // APP VERSION & CHANGELOG CONFIG
  // ==========================================
  const APP_VERSION = 'v2.5.0';
  const APP_BUILD_DATE = '03 Oktober 2026';
  const APP_CHANGELOG = [
    {
      badge: 'Input Kas Massal',
      title: 'Fitur Bulk Input Pemasukan Kas',
      desc: 'Memungkinkan pencatatan pembayaran kas siswa secara massal untuk periode yang dipilih dalam satu langkah cepat, lengkap dengan checklist siswa, pencarian cepat, dan toggle pilih semua.'
    },
    {
      badge: 'Perhitungan Presisi',
      title: 'Perbaikan Kalkulasi Global & Deduplikasi Data',
      desc: 'Memperbaiki algoritma akumulasi saldo Rekap Global agar deduplikasi data ganda bekerja sempurna, mengabaikan transaksi berstatus Belum Lunas, dan menyinkronkan nominal antara Dashboard, Matriks Pemasukan, serta Ekspor PDF/Excel.'
    },
    {
      badge: 'Validasi Siswa',
      title: 'Cegah Duplikasi Nama Siswa',
      desc: 'Menambahkan validasi ketat saat menambah atau mengedit nama siswa untuk mencegah pendaftaran nama yang sama secara tidak sengaja.'
    },
    {
      badge: 'Desain Minimalis',
      title: 'Penyederhanaan Header Modal Dialog',
      desc: 'Menghilangkan tombol silang (X) di pojok atas seluruh popup dialog dan modal. Penutupan kini terpusat lebih intuitif dan bersih melalui tombol aksi Batal / Tutup di bagian bawah baik pada Desktop maupun Mobile.'
    },
    {
      badge: 'UI Presisi',
      title: 'Perbaikan Posisi Dropdown',
      desc: 'Menu pilihan dropdown pada form pengeluaran, pembayaran kas, filter periode, dan setting sekarang menempel rapi tepat di bawah kolom pilihan tanpa melayang ke bawah.'
    },
    {
      badge: 'PWA & Mobile',
      title: 'Instalasi PWA & Akses Cepat',
      desc: 'Dukungan instalasi PWA otomatis di HP Android, iOS Safari (Tambahkan ke Layar Utama), serta Desktop dengan tombol pintasan di sidebar.'
    }
  ];

  // ==========================================
  // CUSTOM SELECT UI ENGINE (Portal Based)
  // Replaces default browser dropdown popup with clean custom UI
  // Attaches directly to body when open so parent transforms / modals never misplace it
  // ==========================================
  class CustomSelect {
    static initAll(root = document) {
      if (!root) return;
      const selects = root.querySelectorAll('select.form-control, select.form-select, .filter-group select, select');
      selects.forEach(sel => CustomSelect.enhance(sel));
    }

    static syncAll(root = document) {
      if (!root) return;
      const selects = root.querySelectorAll('select.form-control, select.form-select, .filter-group select, select');
      selects.forEach(sel => {
        if (sel._customSelectUpdate) sel._customSelectUpdate();
      });
    }

    static closeAll() {
      document.querySelectorAll('.custom-select-container.open').forEach(c => {
        if (c._customSelectClose) c._customSelectClose();
      });
      document.querySelectorAll('.custom-select-menu.open').forEach(m => {
        if (m._customSelectClose) m._customSelectClose();
      });
    }

    static enhance(select) {
      if (!select || select.dataset.customSelectInit === 'true') {
        if (select && select._customSelectUpdate) select._customSelectUpdate();
        return;
      }
      select.dataset.customSelectInit = 'true';

      select.classList.add('custom-select-native-hidden');

      const wrapper = document.createElement('div');
      wrapper.className = 'custom-select-container' + (select.classList.contains('form-control-sm') ? ' custom-select-sm' : '');
      if (select.id) wrapper.id = 'cs-wrap-' + select.id;

      if (select.parentNode) {
        select.parentNode.insertBefore(wrapper, select);
        wrapper.appendChild(select);
      }

      const trigger = document.createElement('div');
      trigger.className = 'custom-select-trigger';
      trigger.tabIndex = 0;
      trigger.setAttribute('role', 'button');
      trigger.setAttribute('aria-haspopup', 'listbox');
      trigger.setAttribute('aria-expanded', 'false');

      const labelSpan = document.createElement('span');
      labelSpan.className = 'custom-select-label';

      const arrowSpan = document.createElement('span');
      arrowSpan.className = 'custom-select-arrow';
      arrowSpan.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';

      trigger.appendChild(labelSpan);
      trigger.appendChild(arrowSpan);
      wrapper.appendChild(trigger);

      const menu = document.createElement('div');
      menu.className = 'custom-select-menu' + (select.classList.contains('form-control-sm') ? ' custom-select-sm' : '');
      menu.setAttribute('role', 'listbox');
      wrapper.appendChild(menu);

      function updateOptions() {
        menu.innerHTML = '';
        const options = Array.from(select.options);
        let selectedText = '';

        options.forEach(opt => {
          const isSelected = opt.value === select.value || (!select.value && opt.selected);
          if (isSelected) selectedText = opt.text;

          const item = document.createElement('div');
          item.className = 'custom-select-option' + (isSelected ? ' selected' : '');
          item.dataset.value = opt.value;
          item.setAttribute('role', 'option');
          item.setAttribute('aria-selected', isSelected ? 'true' : 'false');

          item.innerHTML = '<span class="option-text">' + (opt.text || '') + '</span>' +
            (isSelected ? '<span class="option-check"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></span>' : '');

          item.addEventListener('click', (e) => {
            e.stopPropagation();
            if (select.value !== opt.value) {
              select.value = opt.value;
              select.dispatchEvent(new Event('change', { bubbles: true }));
              select.dispatchEvent(new Event('input', { bubbles: true }));
            }
            closeMenu();
          });

          menu.appendChild(item);
        });

        labelSpan.textContent = selectedText || (select.options[0] ? select.options[0].text : '');
      }

      function positionMenu() {
        if (!wrapper.classList.contains('open')) return;
        const rect = trigger.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) {
          closeMenu();
          return;
        }

        menu.style.position = 'fixed';
        menu.style.left = Math.max(6, Math.min(rect.left, window.innerWidth - rect.width - 6)) + 'px';
        menu.style.width = Math.max(rect.width, 110) + 'px';
        menu.style.minWidth = Math.max(rect.width, 110) + 'px';
        menu.style.zIndex = '9999999';

        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;

        if (spaceBelow < 170 && spaceAbove > spaceBelow) {
          menu.style.top = 'auto';
          menu.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
          menu.style.maxHeight = Math.min(spaceAbove - 16, 230) + 'px';
          menu.style.transformOrigin = 'bottom center';
        } else {
          menu.style.bottom = 'auto';
          menu.style.top = (rect.bottom + 4) + 'px';
          menu.style.maxHeight = Math.min(spaceBelow - 16, 230) + 'px';
          menu.style.transformOrigin = 'top center';
        }
      }

      function openMenu() {
        CustomSelect.closeAll();

        // Portal to body to break free of any ancestor transforms / overflow
        document.body.appendChild(menu);
        wrapper.classList.add('open');
        menu.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
        positionMenu();

        const selectedItem = menu.querySelector('.custom-select-option.selected');
        if (selectedItem && menu.scrollHeight > menu.clientHeight) {
          menu.scrollTop = Math.max(0, selectedItem.offsetTop - 30);
        }
      }

      function closeMenu() {
        wrapper.classList.remove('open');
        menu.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
        if (menu.parentNode === document.body) {
          wrapper.appendChild(menu);
        }
      }

      wrapper._customSelectClose = closeMenu;
      menu._customSelectClose = closeMenu;

      function toggleMenu(e) {
        e.stopPropagation();
        if (wrapper.classList.contains('open')) {
          closeMenu();
        } else {
          openMenu();
        }
      }

      trigger.addEventListener('click', toggleMenu);
      trigger.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleMenu(e);
        } else if (e.key === 'Escape') {
          closeMenu();
        }
      });

      select.addEventListener('change', () => {
        updateOptions();
      });

      const observer = new MutationObserver(() => {
        updateOptions();
      });
      observer.observe(select, { childList: true, subtree: true, attributes: true });

      select._customSelectUpdate = updateOptions;
      updateOptions();
    }
  }

  window.CustomSelect = CustomSelect;

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-select-trigger') && !e.target.closest('.custom-select-menu')) {
      CustomSelect.closeAll();
    }
  });

  window.addEventListener('resize', () => {
    CustomSelect.closeAll();
  }, { passive: true });

  window.addEventListener('scroll', (e) => {
    if (e.target && e.target.closest && (e.target.closest('.custom-select-menu') || (e.target.classList && e.target.classList.contains('custom-select-menu')))) {
      return; // Scrolling inside the menu
    }
    CustomSelect.closeAll();
  }, { passive: true, capture: true });

  // ==========================================
  // 2. INDEXEDDB WRAPPER (Promises-based)
  // ==========================================
  class KasDatabase {
    constructor() {
      this.db = null;
    }

    async init() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;

          // Store: settings (key-value)
          if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings', { keyPath: 'key' });
          }

          // Store: siswa
          if (!db.objectStoreNames.contains('siswa')) {
            const siswaStore = db.createObjectStore('siswa', { keyPath: 'id', autoIncrement: true });
            siswaStore.createIndex('status', 'status', { unique: false });
          }

          // Store: periode
          if (!db.objectStoreNames.contains('periode')) {
            const periodeStore = db.createObjectStore('periode', { keyPath: 'id', autoIncrement: true });
            periodeStore.createIndex('urutan', 'urutan', { unique: false });
          }

          // Store: pemasukan
          if (!db.objectStoreNames.contains('pemasukan')) {
            const pemasukanStore = db.createObjectStore('pemasukan', { keyPath: 'id', autoIncrement: true });
            pemasukanStore.createIndex('siswa_id', 'siswa_id', { unique: false });
            pemasukanStore.createIndex('periode_id', 'periode_id', { unique: false });
          }

          // Store: pengeluaran
          if (!db.objectStoreNames.contains('pengeluaran')) {
            const pengeluaranStore = db.createObjectStore('pengeluaran', { keyPath: 'id', autoIncrement: true });
            pengeluaranStore.createIndex('periode_id', 'periode_id', { unique: false });
            pengeluaranStore.createIndex('kategori', 'kategori', { unique: false });
          }

          // Store: kategori
          if (!db.objectStoreNames.contains('kategori')) {
            db.createObjectStore('kategori', { keyPath: 'id', autoIncrement: true });
          }
        };

        request.onsuccess = (event) => {
          this.db = event.target.result;
          resolve(this.db);
        };

        request.onerror = (event) => {
          console.error('IndexedDB error:', event.target.error);
          reject(event.target.error);
        };
      });
    }

    // Generic transaction helper
    async getAll(storeName) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    }

    async get(storeName, key) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }

    async put(storeName, item) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.put(item);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }

    async add(storeName, item) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.add(item);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }

    async delete(storeName, key) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.delete(key);
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    }

    async clear(storeName) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    }

    // Setting Helpers
    async getSetting(key, defaultValue = null) {
      const row = await this.get('settings', key);
      return row ? row.value : defaultValue;
    }

    async setSetting(key, value) {
      return await this.put('settings', { key, value });
    }
  }

  // ==========================================
  // 3. UTILITY FUNCTIONS
  // ==========================================
  const Utils = {
    // Helper to get index of month (0-11)
    getBulanIndex(bulanName) {
      if (!bulanName) return 0;
      const b = String(bulanName).trim().toLowerCase();
      const idx = MONTHS_ID.findIndex(m => m.toLowerCase() === b);
      return idx !== -1 ? idx : 0;
    },
    // Indonesian Rupiah Formatter: 100000 -> "Rp100.000"
    formatRupiah(amount) {
      if (amount === null || amount === undefined || isNaN(amount)) {
        return 'Rp0';
      }
      const num = Math.round(Number(amount));
      return 'Rp' + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    },

    // Clean Rupiah string to integer: "Rp100.000" -> 100000
    parseRupiah(str) {
      if (typeof str === 'number') return Math.max(0, str);
      if (!str) return 0;
      const clean = str.toString().replace(/[^0-9]/g, '');
      return clean ? parseInt(clean, 10) : 0;
    },

    // Format ISO Date YYYY-MM-DD to DD/MM/YYYY
    formatTanggal(isoDate) {
      if (!isoDate) return '-';
      const parts = isoDate.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return isoDate;
    },

    // Get Today's Date in YYYY-MM-DD
    getTodayISO() {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    },

    // Show Toast Notification
    showToast(message, type = 'success') {
      const container = document.getElementById('toast-container');
      if (!container) return;

      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;

      let iconSvg = '';
      if (type === 'success') {
        iconSvg = '<div class="toast-icon toast-icon-success"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>';
      } else if (type === 'danger') {
        iconSvg = '<div class="toast-icon toast-icon-danger"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div>';
      } else if (type === 'warning') {
        iconSvg = '<div class="toast-icon toast-icon-warning"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>';
      } else {
        iconSvg = '<div class="toast-icon toast-icon-info"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></div>';
      }

      toast.innerHTML = `${iconSvg}<div class="toast-content"><span class="toast-message">${message}</span></div><button class="toast-close-btn" aria-label="Tutup"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`;

      function dismissToast() {
        if (!toast || toast._isDismissing) return;
        toast._isDismissing = true;
        toast.classList.add('toast-hiding');
        setTimeout(() => toast.remove(), 260);
      }

      const closeBtn = toast.querySelector('.toast-close-btn');
      if (closeBtn) closeBtn.addEventListener('click', dismissToast);

      container.appendChild(toast);

      setTimeout(dismissToast, 3500);
    },

    // Form Validator with Custom UI & Toast Alerts (No Browser Balloons)
    validateForm(form) {
      if (!form) return true;
      const requiredInputs = form.querySelectorAll('input[required], select[required], textarea[required]');
      let firstInvalid = null;

      requiredInputs.forEach(input => {
        let isValid = true;
        if (input.type === 'checkbox' || input.type === 'radio') {
          isValid = input.checked;
        } else {
          isValid = Boolean(input.value && String(input.value).trim());
        }

        if (!isValid) {
          input.classList.add('is-invalid');
          const wrapper = input.closest('.custom-select-container');
          if (wrapper) {
            const trigger = wrapper.querySelector('.custom-select-trigger');
            if (trigger) trigger.classList.add('is-invalid');
          }
          if (!firstInvalid) firstInvalid = input;
        } else {
          input.classList.remove('is-invalid');
          const wrapper = input.closest('.custom-select-container');
          if (wrapper) {
            const trigger = wrapper.querySelector('.custom-select-trigger');
            if (trigger) trigger.classList.remove('is-invalid');
          }
        }
      });

      if (firstInvalid) {
        firstInvalid.focus();
        const labelEl = form.querySelector(`label[for="${firstInvalid.id}"]`);
        const labelText = labelEl ? labelEl.textContent.replace('*', '').trim() : 'Kolom Wajib';
        Utils.showToast(`Harap lengkapi kolom: ${labelText}`, 'warning');
        return false;
      }
      return true;
    }
  };

  // Global listeners to clear invalid highlights on user input
  document.addEventListener('input', (e) => {
    if (e.target && e.target.classList) {
      e.target.classList.remove('is-invalid');
      const wrapper = e.target.closest('.custom-select-container');
      if (wrapper) {
        const trigger = wrapper.querySelector('.custom-select-trigger');
        if (trigger) trigger.classList.remove('is-invalid');
      }
    }
  });

  document.addEventListener('change', (e) => {
    if (e.target && e.target.classList) {
      e.target.classList.remove('is-invalid');
      const wrapper = e.target.closest('.custom-select-container');
      if (wrapper) {
        const trigger = wrapper.querySelector('.custom-select-trigger');
        if (trigger) trigger.classList.remove('is-invalid');
      }
    }
  });

  // ==========================================
  // 4. MAIN CONTROLLER & APPLICATION STATE
  // ==========================================
  const App = {
    db: new FirebaseDB(),
    state: {
      settings: {
        className: '9A AB 2',
        academicYear: '2026/2027',
        defaultNominal: 100000,
        initialBalance: 0,
        isSetupCompleted: false
      },
      siswaList: [],
      periodeList: [],
      pemasukanList: [],
      pengeluaranList: [],
      kategoriList: [],
      currentView: 'dashboard',
      pendingRestoreData: null,
      pendingExcelData: null
    },

    async init() {
      try {
        // 1. Inisialisasi Firebase (load SDK, setup Firestore)
        const authLoadingEl = document.getElementById('auth-loading');
        const loginScreenEl = document.getElementById('login-screen');
        const appEl         = document.getElementById('app');

        await this.db.init();

        // 2. Cek status login
        const user = await this.db.waitForAuth();

        if (authLoadingEl) authLoadingEl.classList.add('hidden');

        if (!user) {
          // Belum login — tampilkan login screen
          if (appEl) appEl.style.display = 'none';
          if (loginScreenEl) loginScreenEl.classList.remove('hidden');
          return; // Hentikan init sampai user login
        }

        // Sudah login — lanjut ke setup
        if (appEl) appEl.style.display = '';
        const email = user.email || '';
        if (typeof showUserPill === 'function') showUserPill(email);

        await this.postLoginInit();
      } catch (err) {
        console.error('Initialization failed:', err);
        Utils.showToast('Gagal memuat database: ' + err.message, 'danger');
      }
    },

    // Dipanggil setelah user berhasil login (dari init() atau handleAuthSubmit)
    async postLoginInit() {
      await this.loadInitialData();
      this.setupNavigation();
      this.setupEventListeners();
      this.setupRupiahInputFormatters();

      // Update status indicator
      const indicator = document.getElementById('db-status-indicator');
      const statusTxt = document.getElementById('db-status-text');
      if (indicator) indicator.style.backgroundColor = '#4ade80';
      if (statusTxt) statusTxt.textContent = 'Firebase • Online';

      // Check if first-time setup is needed
      if (!this.state.settings.isSetupCompleted) {
        this.openModal('modal-first-setup');
      }

      // Render current view
      this.renderCurrentView();

      // Check app version for update notifications
      this.checkAppVersion();
    },

    // Load data from IndexedDB into memory state
    async loadInitialData() {
      // 1. Settings
      const isSetup = await this.db.getSetting('is_setup_completed', false);
      const className = await this.db.getSetting('class_name', '9A AB 2');
      const academicYear = await this.db.getSetting('academic_year', '2026/2027');
      const defaultNominal = await this.db.getSetting('default_nominal', 100000);
      const initialBalance = await this.db.getSetting('initial_balance', 0);
      const headerInstitution = await this.db.getSetting('header_institution', '');
      const headerSub = await this.db.getSetting('header_sub', '');
      const headerAddress = await this.db.getSetting('header_address', '');

      this.state.settings = {
        className,
        academicYear,
        defaultNominal: Number(defaultNominal),
        initialBalance: Number(initialBalance),
        headerInstitution: headerInstitution || '',
        headerSub: headerSub || '',
        headerAddress: headerAddress || '',
        isSetupCompleted: Boolean(isSetup)
      };

      // 2. Categories - Seed if empty
      let categories = await this.db.getAll('kategori');
      if (!categories || categories.length === 0) {
        for (const catName of DEFAULT_CATEGORIES) {
          await this.db.add('kategori', { nama: catName });
        }
        categories = await this.db.getAll('kategori');
      }
      this.state.kategoriList = categories;

      // 3. Siswa
      this.state.siswaList = await this.db.getAll('siswa');

      // 4. Periode
      const periods = await this.db.getAll('periode');
      this.state.periodeList = periods.sort((a, b) => (a.urutan || 0) - (b.urutan || 0));

      // 5. Pemasukan
      let rawPemasukan = await this.db.getAll('pemasukan');
      const validSiswaIds = new Set(this.state.siswaList.map(s => String(s.id)));
      const validPeriodeIds = new Set(this.state.periodeList.map(p => String(p.id)));

      const seenMap = new Map();
      const duplicatesToRemove = [];

      rawPemasukan.sort((a, b) => (b.id || 0) - (a.id || 0));

      const cleanPemasukan = [];
      for (const item of rawPemasukan) {
        if (!item) continue;
        const sId = String(item.siswa_id);
        const pId = String(item.periode_id);

        if (!validSiswaIds.has(sId) || !validPeriodeIds.has(pId)) {
          if (item.id) duplicatesToRemove.push(item.id);
          continue;
        }

        const key = `${sId}_${pId}`;
        if (seenMap.has(key)) {
          if (item.id) duplicatesToRemove.push(item.id);
        } else {
          seenMap.set(key, item);
          cleanPemasukan.push(item);
        }
      }

      if (duplicatesToRemove.length > 0) {
        for (const idToRemove of duplicatesToRemove) {
          try {
            await this.db.delete('pemasukan', idToRemove);
          } catch (e) {
            console.warn('Failed deleting duplicate payment ID:', idToRemove, e);
          }
        }
      }

      this.state.pemasukanList = cleanPemasukan;

      // 6. Pengeluaran
      this.state.pengeluaranList = await this.db.getAll('pengeluaran');

      this.updateHeaderInfo();
    },

    updateHeaderInfo() {
      const headerClass = document.getElementById('header-class-name');
      const headerYear = document.getElementById('header-academic-year');
      const sidebarBadge = document.getElementById('sidebar-class-badge');

      if (headerClass) headerClass.textContent = this.state.settings.className;
      if (headerYear) headerYear.textContent = this.state.settings.academicYear;
      if (sidebarBadge) sidebarBadge.textContent = `${this.state.settings.className} \u2022 ${this.state.settings.academicYear}`;
    },

    // Navigation Router
    setupNavigation() {
      const navLinks = document.querySelectorAll('.nav-link');
      navLinks.forEach((link) => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const targetView = link.getAttribute('data-view') || link.getAttribute('href').replace('#', '');
          this.switchView(targetView);
        });
      });

      // Handle direct hash navigation
      window.addEventListener('hashchange', () => {
        const hash = window.location.hash.replace('#', '');
        if (hash) this.switchView(hash);
      });

      if (window.location.hash) {
        this.switchView(window.location.hash.replace('#', ''));
      }
    },

    switchView(viewName) {
      if (!viewName) viewName = 'dashboard';
      this.state.currentView = viewName;

      // Update Nav active state
      document.querySelectorAll('.nav-link').forEach((link) => {
        const linkView = link.getAttribute('data-view');
        if (linkView === viewName) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      });

      // Switch panels
      document.querySelectorAll('.view-panel').forEach((panel) => {
        panel.classList.remove('active');
      });

      const activePanel = document.getElementById(`view-${viewName}`);
      if (activePanel) {
        activePanel.classList.add('active');
      }

      // Update Topbar Title
      const titleEl = document.getElementById('current-view-title');
      const subtitleEl = document.getElementById('current-view-subtitle');

      const viewMeta = {
        dashboard: { title: 'Dashboard', subtitle: 'Ringkasan transaksi dan rekap kas kelas' },
        pemasukan: { title: 'Rekap Pemasukan Kas', subtitle: 'Tabel matriks pembayaran kas siswa per periode (format Excel)' },
        pengeluaran: { title: 'Rekap Pengeluaran Kas', subtitle: 'Catatan pengeluaran, honor, konsumsi, dan operasional kelas' },
        siswa: { title: 'Data Siswa', subtitle: 'Daftar nomor urut, nama, status aktif/nonaktif siswa' },
        periode: { title: 'Periode Kas', subtitle: 'Daftar bulan dan urutan kolom periode kas kelas' },
        cetak: { title: 'Cetak Laporan', subtitle: 'Ekspor laporan PDF rapi atau cetak langsung' },
        pengaturan: { title: 'Pengaturan & Backup', subtitle: 'Konfigurasi kas, kategori, backup/restore JSON, dan import Excel' }
      };

      if (viewMeta[viewName]) {
        if (titleEl) titleEl.textContent = viewMeta[viewName].title;
        if (subtitleEl) subtitleEl.textContent = viewMeta[viewName].subtitle;
      }

      // Close mobile sidebar if open
      this.closeMobileSidebar();

      // Render view content
      this.renderCurrentView();
    },

    renderCurrentView() {
      switch (this.state.currentView) {
        case 'dashboard':
          this.renderDashboard();
          break;
        case 'pemasukan':
          this.renderPemasukanMatrix();
          break;
        case 'pengeluaran':
          this.renderPengeluaran();
          break;
        case 'siswa':
          this.renderSiswa();
          break;
        case 'periode':
          this.renderPeriode();
          break;
        case 'cetak':
          this.renderCetakView();
          break;
        case 'pengaturan':
          this.renderPengaturan();
          break;
      }
      if (window.CustomSelect) {
        window.CustomSelect.initAll();
        window.CustomSelect.syncAll();
      }
    },

    // ==========================================
    // 5. EVENT LISTENERS SETUP
    // ==========================================
    setupEventListeners() {
      // Mobile sidebar toggle
      const mobileMenuBtn = document.getElementById('mobile-menu-btn');
      const sidebarCloseBtn = document.getElementById('sidebar-close-btn');
      const sidebarOverlay = document.getElementById('sidebar-overlay');
      const sidebar = document.getElementById('sidebar');

      if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
          sidebar.classList.add('open');
          sidebarOverlay.classList.add('show');
        });
      }

      if (sidebarCloseBtn) {
        sidebarCloseBtn.addEventListener('click', () => this.closeMobileSidebar());
      }

      if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => this.closeMobileSidebar());
      }

      // Modal close triggers
      document.querySelectorAll('.btn-close-modal, [data-modal]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const modalId = btn.getAttribute('data-modal');
          if (modalId) {
            this.closeModal(modalId);
          }
        });
      });

      // 1. First Setup Form
      const formFirstSetup = document.getElementById('form-first-setup');
      if (formFirstSetup) {
        formFirstSetup.addEventListener('submit', async (e) => {
          e.preventDefault();
          const className = document.getElementById('setup-class-name').value.trim();
          const academicYear = document.getElementById('setup-academic-year').value.trim();
          const defaultNominal = Utils.parseRupiah(document.getElementById('setup-default-nominal').value);
          const initialBalance = Utils.parseRupiah(document.getElementById('setup-initial-balance').value);

          await this.db.setSetting('class_name', className);
          await this.db.setSetting('academic_year', academicYear);
          await this.db.setSetting('default_nominal', defaultNominal);
          await this.db.setSetting('initial_balance', initialBalance);
          await this.db.setSetting('is_setup_completed', true);

          // Create default 4 periods if none exist
          if (this.state.periodeList.length === 0) {
            const currentYear = new Date().getFullYear();
            const defaultMonths = ['Agustus', 'September', 'Oktober', 'November'];
            let order = 1;
            for (const month of defaultMonths) {
              const pid = await this.db.add('periode', {
                bulan: month,
                tahun: currentYear,
                nama_periode: `${month} ${currentYear}`,
                urutan: order++,
                aktif: true
              });
            }
            this.state.periodeList = await this.db.getAll('periode');
          }

          this.state.settings = {
            className,
            academicYear,
            defaultNominal,
            initialBalance,
            isSetupCompleted: true
          };

          this.updateHeaderInfo();
          this.closeModal('modal-first-setup');
          Utils.showToast('Aplikasi siap digunakan!', 'success');
          this.renderCurrentView();
        });
      }

      // 2. Pembayaran Modal Submit & Delete
      const formPembayaran = document.getElementById('form-pembayaran');
      if (formPembayaran) {
        formPembayaran.addEventListener('submit', async (e) => {
          e.preventDefault();
          if (!Utils.validateForm(formPembayaran)) return;
          await this.savePembayaran();
        });
      }

      const btnHapusPembayaran = document.getElementById('btn-hapus-pembayaran');
      if (btnHapusPembayaran) {
        btnHapusPembayaran.addEventListener('click', async () => {
          window.customConfirm('Hapus Pembayaran', 'Apakah Anda yakin ingin menghapus data pembayaran ini?', 'danger').then(async (confirmed) => {
              if (confirmed) {
                const paymentId = parseInt(document.getElementById('pembayaran-id').value, 10);
                if (paymentId) {
                  await this.db.delete('pemasukan', paymentId);
                  this.state.pemasukanList = await this.db.getAll('pemasukan');
                  this.closeModal('modal-pembayaran');
                  Utils.showToast('Data berhasil dihapus.', 'success');
                  this.renderCurrentView();
                }
              }
            })
        });
      }

      // 2b. Bulk Pembayaran Modal Submit & Controls
      const btnOpenBulkPemasukan = document.getElementById('btn-open-modal-bulk-pemasukan');
      const formBulkPemasukan = document.getElementById('form-bulk-pemasukan');
      const btnBulkToggleAll = document.getElementById('btn-bulk-toggle-all');

      if (btnOpenBulkPemasukan) {
        btnOpenBulkPemasukan.addEventListener('click', () => this.openBulkPemasukanModal());
      }

      if (btnBulkToggleAll) {
        btnBulkToggleAll.addEventListener('click', () => this.toggleBulkAllStudents());
      }

      if (formBulkPemasukan) {
        formBulkPemasukan.addEventListener('submit', async (e) => {
          e.preventDefault();
          if (!Utils.validateForm(formBulkPemasukan)) return;
          await this.saveBulkPemasukan();
        });
      }

      // 3. Siswa Form & Open Modal
      const btnOpenTambahSiswa = document.getElementById('btn-open-modal-tambah-siswa');
      const btnEmptyTambahSiswa = document.getElementById('btn-empty-tambah-siswa');
      const formSiswa = document.getElementById('form-siswa');

      const openAddSiswa = () => {
        document.getElementById('form-siswa').reset();
        document.getElementById('siswa-id').value = '';
        document.getElementById('modal-siswa-title').textContent = 'TAMBAH SISWA';
        this.openModal('modal-siswa');
      };

      if (btnOpenTambahSiswa) btnOpenTambahSiswa.addEventListener('click', openAddSiswa);
      if (btnEmptyTambahSiswa) btnEmptyTambahSiswa.addEventListener('click', openAddSiswa);

      if (formSiswa) {
        formSiswa.addEventListener('submit', async (e) => {
          e.preventDefault();
          if (!Utils.validateForm(formSiswa)) return;
          await this.saveSiswa();
        });
      }

      // 4. Periode Form & Open Modal
      const btnOpenTambahPeriode = document.getElementById('btn-open-modal-tambah-periode');
      const btnEmptyTambahPeriode = document.getElementById('btn-empty-tambah-periode');
      const formPeriode = document.getElementById('form-periode');

      const openAddPeriode = () => {
        document.getElementById('form-periode').reset();
        document.getElementById('periode-id').value = '';
        document.getElementById('periode-tahun').value = new Date().getFullYear();
        document.getElementById('periode-urutan').value = (this.state.periodeList.length + 1);
        document.getElementById('periode-aktif').checked = true;
        document.getElementById('modal-periode-title').textContent = 'TAMBAH PERIODE';
        this.openModal('modal-periode');
      };

      if (btnOpenTambahPeriode) btnOpenTambahPeriode.addEventListener('click', openAddPeriode);
      if (btnEmptyTambahPeriode) btnEmptyTambahPeriode.addEventListener('click', openAddPeriode);

      if (formPeriode) {
        formPeriode.addEventListener('submit', async (e) => {
          e.preventDefault();
          if (!Utils.validateForm(formPeriode)) return;
          await this.savePeriode();
        });
      }

      // 5. Pengeluaran Form & Open Modal
      const btnOpenTambahPengeluaran = document.getElementById('btn-open-modal-tambah-pengeluaran');
      const btnEmptyTambahPengeluaran = document.getElementById('btn-empty-tambah-pengeluaran');
      const formPengeluaran = document.getElementById('form-pengeluaran');
      const btnHapusPengeluaranModal = document.getElementById('btn-hapus-pengeluaran-modal');

      const openAddPengeluaran = () => {
        document.getElementById('form-pengeluaran').reset();
        document.getElementById('pengeluaran-id').value = '';
        document.getElementById('pengeluaran-tanggal').value = Utils.getTodayISO();
        document.getElementById('modal-pengeluaran-title').textContent = 'TAMBAH PENGELUARAN';
        document.getElementById('btn-hapus-pengeluaran-modal').classList.add('hidden');
        this.populatePengeluaranModalDropdowns();
        this.openModal('modal-pengeluaran');
      };

      if (btnOpenTambahPengeluaran) btnOpenTambahPengeluaran.addEventListener('click', openAddPengeluaran);
      if (btnEmptyTambahPengeluaran) btnEmptyTambahPengeluaran.addEventListener('click', openAddPengeluaran);

      if (formPengeluaran) {
        formPengeluaran.addEventListener('submit', async (e) => {
          e.preventDefault();
          if (!Utils.validateForm(formPengeluaran)) return;
          await this.savePengeluaran();
        });
      }

      if (btnHapusPengeluaranModal) {
        btnHapusPengeluaranModal.addEventListener('click', async () => {
          window.customConfirm('Hapus Pengeluaran', 'Apakah Anda yakin ingin menghapus catatan pengeluaran ini?', 'danger').then(async (confirmed) => {
              if (confirmed) {
                const expId = parseInt(document.getElementById('pengeluaran-id').value, 10);
                if (expId) {
                  await this.db.delete('pengeluaran', expId);
                  this.state.pengeluaranList = await this.db.getAll('pengeluaran');
                  this.closeModal('modal-pengeluaran');
                  Utils.showToast('Data berhasil dihapus.', 'success');
                  this.renderCurrentView();
                }
              }
            })
        });
      }

      // 6. Settings Info Form
      const formSettings = document.getElementById('form-settings-info');
      if (formSettings) {
        formSettings.addEventListener('submit', async (e) => {
          e.preventDefault();
          if (!Utils.validateForm(formSettings)) return;
          const className = document.getElementById('setting-class-name').value.trim();
          const academicYear = document.getElementById('setting-academic-year').value.trim();
          const defaultNominal = Utils.parseRupiah(document.getElementById('setting-default-nominal').value);
          const initialBalance = Utils.parseRupiah(document.getElementById('setting-initial-balance').value);

          const headerInstitution = (document.getElementById('setting-header-institution')?.value || '').trim();
          const headerSub = (document.getElementById('setting-header-sub')?.value || '').trim();
          const headerAddress = (document.getElementById('setting-header-address')?.value || '').trim();

          await this.db.setSetting('class_name', className);
          await this.db.setSetting('academic_year', academicYear);
          await this.db.setSetting('default_nominal', defaultNominal);
          await this.db.setSetting('initial_balance', initialBalance);
          await this.db.setSetting('header_institution', headerInstitution);
          await this.db.setSetting('header_sub', headerSub);
          await this.db.setSetting('header_address', headerAddress);

          this.state.settings.className = className;
          this.state.settings.academicYear = academicYear;
          this.state.settings.defaultNominal = defaultNominal;
          this.state.settings.initialBalance = initialBalance;
          this.state.settings.headerInstitution = headerInstitution;
          this.state.settings.headerSub = headerSub;
          this.state.settings.headerAddress = headerAddress;

          this.updateHeaderInfo();
          Utils.showToast('Data berhasil diperbarui.', 'success');
          this.renderCurrentView();
        });
      }

      // 7. Kategori Modal & Form
      const btnTambahKategori = document.getElementById('btn-tambah-kategori-modal');
      const formTambahKategori = document.getElementById('form-tambah-kategori');

      if (btnTambahKategori) {
        btnTambahKategori.addEventListener('click', () => {
          document.getElementById('form-tambah-kategori').reset();
          this.openModal('modal-kategori');
        });
      }

      if (formTambahKategori) {
        formTambahKategori.addEventListener('submit', async (e) => {
          e.preventDefault();
          if (!Utils.validateForm(formTambahKategori)) return;
          const catName = document.getElementById('input-nama-kategori').value.trim();
          if (catName) {
            await this.db.add('kategori', { nama: catName });
            this.state.kategoriList = await this.db.getAll('kategori');
            this.closeModal('modal-kategori');
            Utils.showToast('Kategori berhasil ditambahkan.', 'success');
            this.renderPengaturan();
          }
        });
      }

      // 8. Search & Filters Live Handlers
      // Pemasukan search/filter
      const searchPemasukan = document.getElementById('search-pemasukan-nama');
      const filterPemasukanTahun = document.getElementById('filter-pemasukan-tahun');
      const filterPemasukanStatus = document.getElementById('filter-pemasukan-status');
      const btnResetPemasukanFilter = document.getElementById('btn-reset-pemasukan-filter');

      if (searchPemasukan) searchPemasukan.addEventListener('input', debounce(() => this.renderPemasukanMatrix()));
      if (filterPemasukanTahun) filterPemasukanTahun.addEventListener('change', () => this.renderPemasukanMatrix());
      if (filterPemasukanStatus) filterPemasukanStatus.addEventListener('change', () => this.renderPemasukanMatrix());
      if (btnResetPemasukanFilter) {
        btnResetPemasukanFilter.addEventListener('click', () => {
          if (searchPemasukan) searchPemasukan.value = '';
          if (filterPemasukanTahun) filterPemasukanTahun.value = 'ALL';
          if (filterPemasukanStatus) filterPemasukanStatus.value = 'ALL';
          this.renderPemasukanMatrix();
        });
      }

      // Pengeluaran search/filter
      const searchPengeluaran = document.getElementById('search-pengeluaran');
      const filterPengeluaranTahun = document.getElementById('filter-pengeluaran-tahun');
      const filterPengeluaranPeriode = document.getElementById('filter-pengeluaran-periode');
      const filterPengeluaranKategori = document.getElementById('filter-pengeluaran-kategori');
      const btnResetPengeluaranFilter = document.getElementById('btn-reset-pengeluaran-filter');

      if (searchPengeluaran) searchPengeluaran.addEventListener('input', debounce(() => this.renderPengeluaran()));
      if (filterPengeluaranTahun) filterPengeluaranTahun.addEventListener('change', () => this.renderPengeluaran());
      if (filterPengeluaranPeriode) filterPengeluaranPeriode.addEventListener('change', () => this.renderPengeluaran());
      if (filterPengeluaranKategori) filterPengeluaranKategori.addEventListener('change', () => this.renderPengeluaran());
      if (btnResetPengeluaranFilter) {
        btnResetPengeluaranFilter.addEventListener('click', () => {
          if (searchPengeluaran) searchPengeluaran.value = '';
          if (filterPengeluaranTahun) filterPengeluaranTahun.value = 'ALL';
          if (filterPengeluaranPeriode) filterPengeluaranPeriode.value = 'ALL';
          if (filterPengeluaranKategori) filterPengeluaranKategori.value = 'ALL';
          this.renderPengeluaran();
        });
      }

      // Siswa search/filter
      const searchSiswa = document.getElementById('search-siswa-nama');
      const filterSiswaStatus = document.getElementById('filter-siswa-status');
      if (searchSiswa) searchSiswa.addEventListener('input', debounce(() => this.renderSiswa()));
      if (filterSiswaStatus) filterSiswaStatus.addEventListener('change', () => this.renderSiswa());

      // Dashboard filters
      const filterDashYear = document.getElementById('filter-dashboard-year');
      const filterDashPeriod = document.getElementById('filter-dashboard-period');
      const btnResetDashFilter = document.getElementById('btn-reset-dashboard-filter');

      if (filterDashYear) filterDashYear.addEventListener('change', () => this.renderDashboard());
      if (filterDashPeriod) filterDashPeriod.addEventListener('change', () => this.renderDashboard());
      if (btnResetDashFilter) {
        btnResetDashFilter.addEventListener('click', () => {
          if (filterDashYear) filterDashYear.value = 'ALL';
          if (filterDashPeriod) filterDashPeriod.value = 'ALL';
          this.renderDashboard();
        });
      }

      // Quick print buttons from view headers
      const btnQuickPrintGlobal = document.getElementById('btn-quick-print-global');
      if (btnQuickPrintGlobal) {
        btnQuickPrintGlobal.addEventListener('click', () => {
          this.switchView('cetak');
          const radioGlobal = document.querySelector('input[name="report_type"][value="GLOBAL"]');
          if (radioGlobal) {
            radioGlobal.checked = true;
            this.renderCetakPreview();
          }
        });
      }

      const btnQuickPrintPemasukan = document.getElementById('btn-quick-print-pemasukan');
      if (btnQuickPrintPemasukan) {
        btnQuickPrintPemasukan.addEventListener('click', () => {
          this.switchView('cetak');
          const radioPemasukan = document.querySelector('input[name="report_type"][value="PEMASUKAN"]');
          if (radioPemasukan) {
            radioPemasukan.checked = true;
            this.renderCetakPreview();
          }
        });
      }

      const btnQuickPrintPengeluaran = document.getElementById('btn-quick-print-pengeluaran');
      if (btnQuickPrintPengeluaran) {
        btnQuickPrintPengeluaran.addEventListener('click', () => {
          this.switchView('cetak');
          const radioPengeluaran = document.querySelector('input[name="report_type"][value="PENGELUARAN"]');
          if (radioPengeluaran) {
            radioPengeluaran.checked = true;
            this.renderCetakPreview();
          }
        });
      }

      // 9. Backup & Restore Events
      const btnExportJson = document.getElementById('btn-export-backup-json');
      const btnTriggerRestoreJson = document.getElementById('btn-trigger-restore-json');
      const inputRestoreJson = document.getElementById('input-restore-json');
      const btnConfirmRestore = document.getElementById('btn-confirm-execute-restore');

      if (btnExportJson) btnExportJson.addEventListener('click', () => this.exportBackupJson());

      const btnExportExcel = document.getElementById('btn-export-backup-excel');
      if (btnExportExcel) btnExportExcel.addEventListener('click', () => this.exportBackupExcel());

      const btnExportCsv = document.getElementById('btn-export-backup-csv');
      if (btnExportCsv) btnExportCsv.addEventListener('click', () => this.exportBackupCsv());
      if (btnTriggerRestoreJson) btnTriggerRestoreJson.addEventListener('click', () => inputRestoreJson.click());
      if (inputRestoreJson) inputRestoreJson.addEventListener('change', (e) => this.handleRestoreFileSelect(e));
      if (btnConfirmRestore) btnConfirmRestore.addEventListener('click', () => this.executeRestoreJson());

      // 10. Excel Import Events
      const btnTriggerImportExcel = document.getElementById('btn-trigger-import-excel');
      const inputImportExcel = document.getElementById('input-import-excel');
      const btnConfirmExcelImport = document.getElementById('btn-confirm-execute-excel-import');

      if (btnTriggerImportExcel) btnTriggerImportExcel.addEventListener('click', () => inputImportExcel.click());
      if (inputImportExcel) inputImportExcel.addEventListener('change', (e) => this.handleExcelFileSelect(e));
      if (btnConfirmExcelImport) btnConfirmExcelImport.addEventListener('click', () => this.executeExcelImport());

      // 11. PDF & Print Events
      const btnGeneratePdf = document.getElementById('btn-generate-pdf');
      const btnBrowserPrint = document.getElementById('btn-browser-print');
      const reportRadios = document.querySelectorAll('input[name="report_type"]');
      const selectPrintPeriode = document.getElementById('select-print-periode');

      if (btnGeneratePdf) btnGeneratePdf.addEventListener('click', async () => {
        await ensureJsPDF();
        this.generatePdfReport();
      });
      if (btnBrowserPrint) btnBrowserPrint.addEventListener('click', () => this.triggerBrowserPrint());

      reportRadios.forEach((radio) => {
        radio.addEventListener('change', () => this.renderCetakPreview());
      });

      if (selectPrintPeriode) {
        selectPrintPeriode.addEventListener('change', () => this.renderCetakPreview());
      }

      // 12. Logout button
      const btnLogout = document.getElementById('btn-user-logout');
      if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
          window.customConfirm('Konfirmasi Keluar', 'Apakah Anda yakin ingin keluar?', 'danger').then(async (confirmed) => {
              if (confirmed) {
                await this.db.logout();
                Utils.showToast('Berhasil keluar.', 'info');
                setTimeout(() => location.reload(), 800);
              }
            })
        });
      }
    },

    // Auto Rupiah live input formatter
    setupRupiahInputFormatters() {
      document.addEventListener('input', (e) => {
        if (e.target.classList.contains('format-rupiah')) {
          const val = e.target.value.replace(/[^0-9]/g, '');
          if (val) {
            e.target.value = parseInt(val, 10).toLocaleString('id-ID');
          } else {
            e.target.value = '';
          }
        }
      });
    },

    closeMobileSidebar() {
      const sidebar = document.getElementById('sidebar');
      const sidebarOverlay = document.getElementById('sidebar-overlay');
      if (sidebar) sidebar.classList.remove('open');
      if (sidebarOverlay) sidebarOverlay.classList.remove('show');
    },

    openModal(modalId) {
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.classList.add('show');
        if (window.CustomSelect) {
          window.CustomSelect.initAll(modal);
          window.CustomSelect.syncAll(modal);
        }
      }
    },

    closeModal(modalId) {
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.classList.remove('show');
        modal.querySelectorAll('.custom-select-container.open').forEach(c => {
          c.classList.remove('open');
          const trg = c.querySelector('.custom-select-trigger');
          if (trg) trg.setAttribute('aria-expanded', 'false');
        });
      }
    },

    checkAppVersion() {
      const storedVersion = localStorage.getItem('rekapkas_app_version');
      if (!storedVersion) {
        localStorage.setItem('rekapkas_app_version', APP_VERSION);
      } else if (storedVersion !== APP_VERSION) {
        localStorage.setItem('rekapkas_app_version', APP_VERSION);
        setTimeout(() => {
          Utils.showToast(`🎉 Rekap Kas diperbarui ke ${APP_VERSION}!`, 'success');
        }, 1200);
      }
    },

    showChangelogModal() {
      const listEl = document.getElementById('changelog-items-list');
      const verEl = document.getElementById('changelog-modal-version');
      const dateEl = document.getElementById('changelog-modal-date');
      if (verEl) verEl.textContent = APP_VERSION;
      if (dateEl) dateEl.textContent = APP_BUILD_DATE;

      if (listEl) {
        listEl.innerHTML = APP_CHANGELOG.map(item => `
          <div class="changelog-item">
            <div class="changelog-item-header">
              <span class="changelog-badge">${item.badge}</span>
              <h4 class="changelog-item-title">${item.title}</h4>
            </div>
            <p class="changelog-item-desc">${item.desc}</p>
          </div>
        `).join('');
      }

      this.openModal('modal-changelog');
    },

    // ==========================================
    // 6. DASHBOARD & REKAP GLOBAL CALCULATIONS
    // ==========================================
    renderDashboard() {
      // 1. Populate Filter Dropdowns
      const filterYear = document.getElementById('filter-dashboard-year');
      const filterPeriod = document.getElementById('filter-dashboard-period');

      const years = [...new Set(this.state.periodeList.map(p => p.tahun))].filter(Boolean).sort();
      const currentSelectedYear = filterYear ? filterYear.value : 'ALL';
      const currentSelectedPeriod = filterPeriod ? filterPeriod.value : 'ALL';

      if (filterYear) {
        filterYear.innerHTML = '<option value="ALL">Semua Tahun</option>' +
          years.map(y => `<option value="${y}" ${y.toString() === currentSelectedYear ? 'selected' : ''}>${y}</option>`).join('');
      }

      if (filterPeriod) {
        let filteredPeriods = this.state.periodeList;
        if (filterYear && filterYear.value !== 'ALL') {
          filteredPeriods = filteredPeriods.filter(p => p.tahun.toString() === filterYear.value);
        }
        filterPeriod.innerHTML = '<option value="ALL">Semua Periode</option>' +
          filteredPeriods.map(p => `<option value="${p.id}" ${p.id.toString() === currentSelectedPeriod ? 'selected' : ''}>${p.nama_periode || p.bulan + ' ' + p.tahun}</option>`).join('');
      }

      // 2. Compute Global rolling balances
      const globalData = this.calculateRekapGlobal();

      // Filter global data according to dashboard filters
      let displayGlobalData = globalData;
      if (filterYear && filterYear.value !== 'ALL') {
        displayGlobalData = displayGlobalData.filter(d => d.periode.tahun.toString() === filterYear.value);
      }
      if (filterPeriod && filterPeriod.value !== 'ALL') {
        displayGlobalData = displayGlobalData.filter(d => d.periode.id.toString() === filterPeriod.value);
      }

      // Calculate totals
      let totalIncome = globalData.reduce((sum, d) => sum + d.pemasukan, 0);
      let totalExpense = globalData.reduce((sum, d) => sum + d.pengeluaran, 0);
      let currentBalance = Number(this.state.settings.initialBalance) + totalIncome - totalExpense;

      const activeStudentsCount = this.state.siswaList.filter(s => s.status === 'Aktif').length;
      const totalStudentsCount = this.state.siswaList.length;

      const validPaymentMap = this.getValidPaymentMap();
      const validPaymentsCount = Object.values(validPaymentMap).filter(p => p && p.status !== 'Belum Lunas').length;

      // Update Stat Cards
      const statCurrentBalance = document.getElementById('stat-current-balance');
      const statTotalIncome = document.getElementById('stat-total-income');
      const statTotalExpense = document.getElementById('stat-total-expense');
      const statActiveStudents = document.getElementById('stat-active-students');
      const statIncomeCount = document.getElementById('stat-income-count');
      const statExpenseCount = document.getElementById('stat-expense-count');
      const statTotalStudents = document.getElementById('stat-total-students');

      if (statCurrentBalance) statCurrentBalance.textContent = Utils.formatRupiah(currentBalance);
      if (statTotalIncome) statTotalIncome.textContent = Utils.formatRupiah(totalIncome);
      if (statTotalExpense) statTotalExpense.textContent = Utils.formatRupiah(totalExpense);
      if (statActiveStudents) statActiveStudents.textContent = activeStudentsCount;
      if (statIncomeCount) statIncomeCount.textContent = `${validPaymentsCount} Transaksi Kas`;
      if (statExpenseCount) statExpenseCount.textContent = `${this.state.pengeluaranList.length} Transaksi Pengeluaran`;
      if (statTotalStudents) statTotalStudents.textContent = `Total ${totalStudentsCount} Siswa Terdaftar`;

      // Render Rekap Global Table
      const tbody = document.getElementById('tbody-rekap-global');
      const emptyState = document.getElementById('empty-state-global');
      const totalInitialEl = document.getElementById('global-total-initial-balance');
      const totalIncomeEl = document.getElementById('global-total-income');
      const totalExpenseEl = document.getElementById('global-total-expense');
      const finalBalanceEl = document.getElementById('global-final-balance');

      if (!tbody) return;

      if (displayGlobalData.length === 0) {
        tbody.innerHTML = '';
        if (emptyState) emptyState.classList.remove('hidden');
        if (totalIncomeEl) totalIncomeEl.textContent = 'Rp0';
        if (totalExpenseEl) totalExpenseEl.textContent = 'Rp0';
        if (finalBalanceEl) finalBalanceEl.textContent = 'Rp0';
        return;
      }

      if (emptyState) emptyState.classList.add('hidden');

      let filteredIncomeSum = 0;
      let filteredExpenseSum = 0;

      let html = '';
      displayGlobalData.forEach((row, index) => {
        filteredIncomeSum += row.pemasukan;
        filteredExpenseSum += row.pengeluaran;

        html += `
          <tr>
            <td class="text-center font-bold">${index + 1}</td>
            <td class="font-bold">${row.periode.nama_periode || row.periode.bulan + ' ' + row.periode.tahun}</td>
            <td class="text-right">${Utils.formatRupiah(row.saldoAwal)}</td>
            <td class="text-right text-success font-bold">+ ${Utils.formatRupiah(row.pemasukan)}</td>
            <td class="text-right text-danger font-bold">- ${Utils.formatRupiah(row.pengeluaran)}</td>
            <td class="text-right text-primary font-bold">${Utils.formatRupiah(row.saldoAkhir)}</td>
          </tr>
        `;
      });

      tbody.innerHTML = html;

      if (totalInitialEl) {
        totalInitialEl.textContent = Utils.formatRupiah(displayGlobalData[0]?.saldoAwal || this.state.settings.initialBalance);
      }
      if (totalIncomeEl) totalIncomeEl.textContent = Utils.formatRupiah(filteredIncomeSum);
      if (totalExpenseEl) totalExpenseEl.textContent = Utils.formatRupiah(filteredExpenseSum);
      if (finalBalanceEl) {
        const lastRow = displayGlobalData[displayGlobalData.length - 1];
        finalBalanceEl.textContent = Utils.formatRupiah(lastRow ? lastRow.saldoAkhir : currentBalance);
      }
    },

    // Helper to get valid, deduplicated payments indexed by student & period
    getValidPaymentMap() {
      const studentIds = new Set(this.state.siswaList.map(s => String(s.id)));
      const periodIds = new Set(this.state.periodeList.map(p => String(p.id)));
      const paymentMap = {};

      this.state.pemasukanList.forEach((pay) => {
        if (!pay) return;
        const sId = String(pay.siswa_id);
        const pId = String(pay.periode_id);

        if (studentIds.has(sId) && periodIds.has(pId)) {
          const key = `${sId}_${pId}`;
          if (!paymentMap[key] || (pay.id && pay.id > (paymentMap[key].id || 0))) {
            paymentMap[key] = pay;
          }
        }
      });

      return paymentMap;
    },

    // Rolling balance calculation per period in sequential order
    calculateRekapGlobal() {
      const sortedPeriods = [...this.state.periodeList].sort((a, b) => (a.urutan || 0) - (b.urutan || 0));
      const paymentMap = this.getValidPaymentMap();
      const result = [];
      let runningBalance = Number(this.state.settings.initialBalance) || 0;

      for (const p of sortedPeriods) {
        let periodIncome = 0;
        this.state.siswaList.forEach((s) => {
          const pay = paymentMap[`${s.id}_${p.id}`];
          if (pay && pay.status !== 'Belum Lunas') {
            periodIncome += (Number(pay.nominal) || 0);
          }
        });

        const periodExpense = this.state.pengeluaranList
          .filter(item => String(item.periode_id) === String(p.id))
          .reduce((sum, item) => sum + (Number(item.nominal) || 0), 0);

        const saldoAwal = runningBalance;
        const saldoAkhir = saldoAwal + periodIncome - periodExpense;
        runningBalance = saldoAkhir;

        result.push({
          periode: p,
          saldoAwal,
          pemasukan: periodIncome,
          pengeluaran: periodExpense,
          saldoAkhir
        });
      }

      return result;
    },

    // ==========================================
    // 7. PEMASUKAN VIEW (MATRIX TABLE SISWA x PERIODE)
    // ==========================================
    renderPemasukanMatrix() {
      // 1. Populate Filters
      const filterTahun = document.getElementById('filter-pemasukan-tahun');
      const searchNama = document.getElementById('search-pemasukan-nama');
      const filterStatus = document.getElementById('filter-pemasukan-status');

      const years = [...new Set(this.state.periodeList.map(p => p.tahun))].filter(Boolean).sort();
      const currentSelectedYear = filterTahun ? filterTahun.value : 'ALL';

      if (filterTahun) {
        filterTahun.innerHTML = '<option value="ALL">Semua Tahun</option>' +
          years.map(y => `<option value="${y}" ${y.toString() === currentSelectedYear ? 'selected' : ''}>${y}</option>`).join('');
      }

      // Filter active periods
      let activePeriods = this.state.periodeList.filter(p => p.aktif !== false);
      if (filterTahun && filterTahun.value !== 'ALL') {
        activePeriods = activePeriods.filter(p => p.tahun.toString() === filterTahun.value);
      }
      activePeriods.sort((a, b) => (a.urutan || 0) - (b.urutan || 0));

      // Filter students
      const searchQuery = searchNama ? searchNama.value.toLowerCase().trim() : '';
      const statusFilter = filterStatus ? filterStatus.value : 'ALL';

      let students = [...this.state.siswaList];

      if (searchQuery) {
        students = students.filter(s => s.nama.toLowerCase().includes(searchQuery));
      }

      // Empty state handling
      const emptyState = document.getElementById('empty-state-pemasukan');
      const table = document.getElementById('table-matrix-pemasukan');
      const thead = document.getElementById('thead-matrix-pemasukan');
      const tbody = document.getElementById('tbody-matrix-pemasukan');
      const tfoot = document.getElementById('tfoot-matrix-pemasukan');

      if (students.length === 0 || activePeriods.length === 0) {
        if (thead) thead.innerHTML = '';
        if (tbody) tbody.innerHTML = '';
        if (tfoot) tfoot.innerHTML = '';
        if (emptyState) emptyState.classList.remove('hidden');
        return;
      }

      if (emptyState) emptyState.classList.add('hidden');

      // 2. Build Header
      let headHtml = `
        <tr>
          <th class="sticky-col-1">No</th>
          <th class="sticky-col-2">Nama Siswa</th>
      `;
      activePeriods.forEach((p) => {
        headHtml += `<th class="text-right" style="min-width: 110px;">${p.bulan}<br><small style="font-weight: normal; color: rgba(255, 255, 255, 0.8);">${p.tahun}</small></th>`;
      });
      headHtml += `<th class="text-right font-bold" style="min-width: 120px;">Total</th></tr>`;
      thead.innerHTML = headHtml;

      // 3. Build Body Rows & Track Period Totals
      const periodColumnTotals = {};
      activePeriods.forEach(p => periodColumnTotals[p.id] = 0);
      let grandTotalSum = 0;

      // Index payments by `siswa_id_periode_id` for fast lookup
      const paymentMap = this.getValidPaymentMap();

      let bodyHtml = '';
      let displayIndex = 1;

      students.forEach((s) => {
        let studentTotal = 0;
        let cellsHtml = '';
        let hasMatchedPaymentStatus = (statusFilter === 'ALL');

        activePeriods.forEach((p) => {
          const pay = paymentMap[`${s.id}_${p.id}`];
          const nominal = pay ? (Number(pay.nominal) || 0) : 0;
          const status = pay ? (pay.status || 'Lunas') : '';

          if (statusFilter !== 'ALL' && pay && pay.status === statusFilter) {
            hasMatchedPaymentStatus = true;
          }

          if (pay) {
            const isPaid = (status !== 'Belum Lunas');
            const effectiveNominal = isPaid ? nominal : 0;

            studentTotal += effectiveNominal;
            periodColumnTotals[p.id] += effectiveNominal;

            let badgeClass = 'badge-success';
            if (status === 'Belum Lunas') badgeClass = 'badge-warning';
            if (status === 'BOYONG') badgeClass = 'badge-boyong';
            if (status === 'Lainnya') badgeClass = 'badge-secondary';

            cellsHtml += `
              <td class="matrix-cell-clickable" data-siswa-id="${s.id}" data-periode-id="${p.id}" title="Klik untuk edit pembayaran">
                <div>${Utils.formatRupiah(nominal)}</div>
                <div><span class="badge ${badgeClass}" style="font-size: 0.7rem; padding: 1px 4px;">${status}</span></div>
              </td>
            `;
          } else {
            cellsHtml += `
              <td class="matrix-cell-clickable matrix-cell-empty" data-siswa-id="${s.id}" data-periode-id="${p.id}" title="Klik untuk tambah pembayaran">
                -
              </td>
            `;
          }
        });

        // Filter status check: if statusFilter is active, skip row if no payment matched
        if (statusFilter !== 'ALL' && !hasMatchedPaymentStatus) {
          return;
        }

        grandTotalSum += studentTotal;

        bodyHtml += `
          <tr>
            <td class="sticky-col-1 font-bold text-center">${displayIndex++}</td>
            <td class="sticky-col-2" title="${s.nama}">
              ${s.nama}
              ${s.status === 'Nonaktif' ? '<span class="badge badge-secondary" style="font-size:0.65rem; margin-left:4px;">Nonaktif</span>' : ''}
            </td>
            ${cellsHtml}
            <td class="text-right font-bold text-primary" style="background-color: #f8fafc;">${Utils.formatRupiah(studentTotal)}</td>
          </tr>
        `;
      });

      tbody.innerHTML = bodyHtml;

      // 4. Build Footer (Totals)
      let footHtml = `
        <tr class="table-total-row">
          <td class="sticky-col-1 text-center font-bold"></td>
          <td class="sticky-col-2 font-bold text-center">TOTAL KAS</td>
      `;

      activePeriods.forEach((p) => {
        const colTotal = periodColumnTotals[p.id] || 0;
        footHtml += `<td class="text-right font-bold text-success">${Utils.formatRupiah(colTotal)}</td>`;
      });

      footHtml += `<td class="text-right font-bold text-primary" style="background-color: #cbd5e1;">${Utils.formatRupiah(grandTotalSum)}</td></tr>`;
      tfoot.innerHTML = footHtml;

      // 5. Attach click event to cells for fast payment modal
      tbody.querySelectorAll('.matrix-cell-clickable').forEach((cell) => {
        cell.addEventListener('click', () => {
          const siswaId = parseInt(cell.getAttribute('data-siswa-id'), 10);
          const periodeId = parseInt(cell.getAttribute('data-periode-id'), 10);
          this.openPembayaranModal(siswaId, periodeId);
        });
      });
    },

    openPembayaranModal(siswaId, periodeId) {
      const siswa = this.state.siswaList.find(s => s.id === siswaId);
      const periode = this.state.periodeList.find(p => p.id === periodeId);
      if (!siswa || !periode) return;

      const existingPayment = this.state.pemasukanList.find(
        pay => String(pay.siswa_id) === String(siswaId) && String(pay.periode_id) === String(periodeId)
      );

      // Populate Modal Fields
      document.getElementById('pembayaran-siswa-id').value = siswaId;
      document.getElementById('pembayaran-periode-id').value = periodeId;
      document.getElementById('pembayaran-nama-siswa').textContent = siswa.nama;
      const periodName = periode.nama_periode || `${periode.bulan} ${periode.tahun}`;
      document.getElementById('pembayaran-nama-periode').textContent = periodName;

      const btnHapus = document.getElementById('btn-hapus-pembayaran');
      const btnSimpan = document.getElementById('btn-simpan-pembayaran');
      const titleEl = document.getElementById('modal-pembayaran-title');

      if (existingPayment) {
        document.getElementById('pembayaran-id').value = existingPayment.id;
        document.getElementById('pembayaran-tanggal').value = existingPayment.tanggal || Utils.getTodayISO();
        document.getElementById('pembayaran-nominal').value = parseInt(existingPayment.nominal || 0, 10).toLocaleString('id-ID');
        document.getElementById('pembayaran-status').value = existingPayment.status || 'Lunas';
        document.getElementById('pembayaran-keterangan').value = existingPayment.keterangan || '';

        titleEl.textContent = 'EDIT PEMBAYARAN KAS';
        btnSimpan.textContent = 'Perbarui';
        btnHapus.classList.remove('hidden');
      } else {
        document.getElementById('pembayaran-id').value = '';
        document.getElementById('pembayaran-tanggal').value = Utils.getTodayISO();
        const defaultNominal = this.state.settings.defaultNominal || 100000;
        document.getElementById('pembayaran-nominal').value = defaultNominal.toLocaleString('id-ID');
        document.getElementById('pembayaran-status').value = 'Lunas';
        document.getElementById('pembayaran-keterangan').value = '';

        titleEl.textContent = 'INPUT PEMBAYARAN KAS';
        btnSimpan.textContent = 'Simpan';
        btnHapus.classList.add('hidden');
      }

      this.openModal('modal-pembayaran');
    },

    async savePembayaran() {
      const paymentId = document.getElementById('pembayaran-id').value;
      const siswaId = parseInt(document.getElementById('pembayaran-siswa-id').value, 10);
      const periodeId = parseInt(document.getElementById('pembayaran-periode-id').value, 10);
      const tanggal = document.getElementById('pembayaran-tanggal').value;
      const nominal = Utils.parseRupiah(document.getElementById('pembayaran-nominal').value);
      const status = document.getElementById('pembayaran-status').value;
      const keterangan = document.getElementById('pembayaran-keterangan').value.trim();

      if (!siswaId || !periodeId || !tanggal) {
        window.customAlert('Peringatan', 'Mohon lengkapi seluruh kolom wajib.', 'warning'); return;
        return;
      }

      if (nominal <= 0) {
        window.customAlert('Peringatan', 'Nominal pembayaran harus lebih dari Rp0.', 'warning'); return;
        return;
      }

      // Check duplicate rule: 1 student max 1 payment per period
      const existing = this.state.pemasukanList.find(
        p => String(p.siswa_id) === String(siswaId) && String(p.periode_id) === String(periodeId) && String(p.id) !== String(paymentId)
      );

      if (existing) {
        window.customAlert('Duplikasi', 'Pembayaran siswa untuk periode ini sudah ada. Silakan edit transaksi yang tersedia.', 'warning'); return;
        return;
      }

      const now = new Date().toISOString();
      if (paymentId) {
        // Update
        const item = {
          id: parseInt(paymentId, 10),
          siswa_id: siswaId,
          periode_id: periodeId,
          tanggal,
          nominal,
          status,
          keterangan,
          updated_at: now
        };
        await this.db.put('pemasukan', item);
        Utils.showToast('Data berhasil diperbarui.', 'success');
      } else {
        // Add
        const item = {
          siswa_id: siswaId,
          periode_id: periodeId,
          tanggal,
          nominal,
          status,
          keterangan,
          created_at: now,
          updated_at: now
        };
        await this.db.add('pemasukan', item);
        Utils.showToast('Data berhasil disimpan.', 'success');
      }

      this.state.pemasukanList = await this.db.getAll('pemasukan');
      this.closeModal('modal-pembayaran');
      this.renderCurrentView();
    },

    // Bulk Input Pemasukan Methods
    openBulkPemasukanModal() {
      const selectPeriode = document.getElementById('bulk-pemasukan-periode-id');
      const inputTanggal = document.getElementById('bulk-pemasukan-tanggal');
      const inputNominal = document.getElementById('bulk-pemasukan-nominal');
      const selectStatus = document.getElementById('bulk-pemasukan-status');
      const searchBox = document.getElementById('bulk-search-siswa');

      if (!selectPeriode) return;

      const sortedPeriods = [...this.state.periodeList]
        .filter(p => p.aktif !== false)
        .sort((a, b) => (a.urutan || 0) - (b.urutan || 0));

      if (sortedPeriods.length === 0) {
        window.customAlert('Periode Kosong', 'Tidak ada periode kas aktif untuk diinput. Silakan tambah periode baru terlebih dahulu.', 'warning');
        return;
      }

      selectPeriode.innerHTML = sortedPeriods.map(p =>
        `<option value="${p.id}">${p.nama_periode || (p.bulan + ' ' + p.tahun)}</option>`
      ).join('');

      inputTanggal.value = Utils.getTodayISO();
      const defaultNominal = this.state.settings.defaultNominal || 100000;
      inputNominal.value = defaultNominal.toLocaleString('id-ID');
      selectStatus.value = 'Lunas';
      if (searchBox) searchBox.value = '';

      this.renderBulkStudentList();

      selectPeriode.onchange = () => this.renderBulkStudentList();
      if (searchBox) {
        searchBox.oninput = () => this.renderBulkStudentList();
      }

      this.openModal('modal-bulk-pemasukan');
    },

    renderBulkStudentList() {
      const container = document.getElementById('bulk-students-list-container');
      const selectedPeriodId = document.getElementById('bulk-pemasukan-periode-id')?.value;
      const searchVal = (document.getElementById('bulk-search-siswa')?.value || '').toLowerCase().trim();
      const countEl = document.getElementById('bulk-selected-count');

      if (!container || !selectedPeriodId) return;

      const paymentMap = this.getValidPaymentMap();
      let activeStudents = this.state.siswaList.filter(s => s.status === 'Aktif');

      if (searchVal) {
        activeStudents = activeStudents.filter(s => s.nama.toLowerCase().includes(searchVal));
      }

      activeStudents.sort((a, b) => a.nama.localeCompare(b.nama));

      if (activeStudents.length === 0) {
        container.innerHTML = '<div class="text-center text-muted p-3">Tidak ada siswa ditemukan</div>';
        if (countEl) countEl.textContent = '0';
        return;
      }

      let html = '';
      activeStudents.forEach((s) => {
        const existingPay = paymentMap[`${s.id}_${selectedPeriodId}`];
        const hasPaid = existingPay && existingPay.status === 'Lunas';
        const currentStatus = existingPay ? existingPay.status : 'Belum Bayar';

        let badgeClass = 'badge-secondary';
        if (currentStatus === 'Lunas') badgeClass = 'badge-success';
        if (currentStatus === 'Belum Lunas') badgeClass = 'badge-warning';

        const isCheckedByDef = !hasPaid;

        html += `
          <div class="bulk-student-item mb-1">
            <label for="chk-bulk-siswa-${s.id}">
              <div style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" class="chk-bulk-siswa" id="chk-bulk-siswa-${s.id}" value="${s.id}" ${isCheckedByDef ? 'checked' : ''}>
                <span class="font-bold">${s.nama}</span>
              </div>
              <span class="badge ${badgeClass}" style="font-size: 0.72rem; padding: 2px 6px;">${currentStatus}</span>
            </label>
          </div>
        `;
      });

      container.innerHTML = html;

      const updateCount = () => {
        const checked = container.querySelectorAll('.chk-bulk-siswa:checked').length;
        if (countEl) countEl.textContent = checked;
      };

      container.querySelectorAll('.chk-bulk-siswa').forEach(chk => chk.addEventListener('change', updateCount));
      updateCount();
    },

    toggleBulkAllStudents() {
      const container = document.getElementById('bulk-students-list-container');
      const btnToggle = document.getElementById('btn-bulk-toggle-all');
      if (!container || !btnToggle) return;

      const checkboxes = container.querySelectorAll('.chk-bulk-siswa');
      if (checkboxes.length === 0) return;

      const anyUnchecked = Array.from(checkboxes).some(c => !c.checked);
      checkboxes.forEach(c => c.checked = anyUnchecked);

      btnToggle.textContent = anyUnchecked ? 'Hapus Semua' : 'Pilih Semua';

      const countEl = document.getElementById('bulk-selected-count');
      if (countEl) countEl.textContent = anyUnchecked ? checkboxes.length : 0;
    },

    async saveBulkPemasukan() {
      const periodeId = parseInt(document.getElementById('bulk-pemasukan-periode-id').value, 10);
      const tanggal = document.getElementById('bulk-pemasukan-tanggal').value;
      const nominal = Utils.parseRupiah(document.getElementById('bulk-pemasukan-nominal').value);
      const status = document.getElementById('bulk-pemasukan-status').value;

      const checkedBoxes = document.querySelectorAll('#bulk-students-list-container .chk-bulk-siswa:checked');
      const selectedSiswaIds = Array.from(checkedBoxes).map(c => parseInt(c.value, 10));

      if (!periodeId || !tanggal) {
        window.customAlert('Peringatan', 'Mohon pilih periode dan tanggal pembayaran.', 'warning');
        return;
      }

      if (selectedSiswaIds.length === 0) {
        window.customAlert('Peringatan', 'Pilih minimal satu siswa untuk diinput pembayarannya.', 'warning');
        return;
      }

      const now = new Date().toISOString();

      for (const siswaId of selectedSiswaIds) {
        const existing = this.state.pemasukanList.find(
          p => String(p.siswa_id) === String(siswaId) && String(p.periode_id) === String(periodeId)
        );

        if (existing) {
          const item = {
            id: existing.id,
            siswa_id: siswaId,
            periode_id: periodeId,
            tanggal,
            nominal,
            status,
            keterangan: existing.keterangan || 'Bulk Input',
            updated_at: now
          };
          await this.db.put('pemasukan', item);
        } else {
          const item = {
            siswa_id: siswaId,
            periode_id: periodeId,
            tanggal,
            nominal,
            status,
            keterangan: 'Bulk Input',
            created_at: now,
            updated_at: now
          };
          await this.db.add('pemasukan', item);
        }
      }

      this.state.pemasukanList = await this.db.getAll('pemasukan');
      this.closeModal('modal-bulk-pemasukan');
      Utils.showToast(`Berhasil menyimpan kas massal untuk ${selectedSiswaIds.length} siswa!`, 'success');
      this.renderCurrentView();
    },

    // ==========================================
    // 8. PENGELUARAN VIEW
    // ==========================================
    populatePengeluaranModalDropdowns() {
      const selectPeriode = document.getElementById('pengeluaran-periode-id');
      const selectKategori = document.getElementById('pengeluaran-kategori');

      if (selectPeriode) {
        selectPeriode.innerHTML = this.state.periodeList.map(p =>
          `<option value="${p.id}">${p.nama_periode || p.bulan + ' ' + p.tahun}</option>`
        ).join('');
      }

      if (selectKategori) {
        selectKategori.innerHTML = this.state.kategoriList.map(k =>
          `<option value="${k.nama}">${k.nama}</option>`
        ).join('');
      }
    },

    renderPengeluaran() {
      // 1. Populate Filter Dropdowns
      const filterTahun = document.getElementById('filter-pengeluaran-tahun');
      const filterPeriode = document.getElementById('filter-pengeluaran-periode');
      const filterKategori = document.getElementById('filter-pengeluaran-kategori');
      const searchBox = document.getElementById('search-pengeluaran');

      const years = [...new Set(this.state.periodeList.map(p => p.tahun))].filter(Boolean).sort();
      const currentYear = filterTahun ? filterTahun.value : 'ALL';
      const currentPeriod = filterPeriode ? filterPeriode.value : 'ALL';
      const currentCat = filterKategori ? filterKategori.value : 'ALL';

      if (filterTahun) {
        filterTahun.innerHTML = '<option value="ALL">Semua Tahun</option>' +
          years.map(y => `<option value="${y}" ${y.toString() === currentYear ? 'selected' : ''}>${y}</option>`).join('');
      }

      if (filterPeriode) {
        let periods = this.state.periodeList;
        if (filterTahun && filterTahun.value !== 'ALL') {
          periods = periods.filter(p => p.tahun.toString() === filterTahun.value);
        }
        filterPeriode.innerHTML = '<option value="ALL">Semua Periode</option>' +
          periods.map(p => `<option value="${p.id}" ${p.id.toString() === currentPeriod ? 'selected' : ''}>${p.nama_periode || p.bulan + ' ' + p.tahun}</option>`).join('');
      }

      if (filterKategori) {
        filterKategori.innerHTML = '<option value="ALL">Semua Kategori</option>' +
          this.state.kategoriList.map(k => `<option value="${k.nama}" ${k.nama === currentCat ? 'selected' : ''}>${k.nama}</option>`).join('');
      }

      // 2. Filter records
      const searchQuery = searchBox ? searchBox.value.toLowerCase().trim() : '';

      let list = [...this.state.pengeluaranList];

      if (filterTahun && filterTahun.value !== 'ALL') {
        const periodIdsInYear = this.state.periodeList.filter(p => p.tahun.toString() === filterTahun.value).map(p => String(p.id));
        list = list.filter(item => periodIdsInYear.includes(String(item.periode_id)));
      }

      if (filterPeriode && filterPeriode.value !== 'ALL') {
        list = list.filter(item => String(item.periode_id) === filterPeriode.value);
      }

      if (filterKategori && filterKategori.value !== 'ALL') {
        list = list.filter(item => item.kategori === filterKategori.value);
      }

      if (searchQuery) {
        list = list.filter(item =>
          (item.keterangan && item.keterangan.toLowerCase().includes(searchQuery)) ||
          (item.kategori && item.kategori.toLowerCase().includes(searchQuery))
        );
      }

      // Sort by date descending
      list.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

      // 3. Render Table
      const tbody = document.getElementById('tbody-pengeluaran');
      const emptyState = document.getElementById('empty-state-pengeluaran');
      const totalNominalEl = document.getElementById('total-pengeluaran-nominal');

      if (!tbody) return;

      if (list.length === 0) {
        tbody.innerHTML = '';
        if (emptyState) emptyState.classList.remove('hidden');
        if (totalNominalEl) totalNominalEl.textContent = 'Rp0';
        return;
      }

      if (emptyState) emptyState.classList.add('hidden');

      let totalExpenseSum = 0;
      let html = '';

      // Period lookup map
      const periodMap = {};
      this.state.periodeList.forEach(p => periodMap[p.id] = p.nama_periode || `${p.bulan} ${p.tahun}`);

      list.forEach((item, index) => {
        const nominal = Number(item.nominal) || 0;
        totalExpenseSum += nominal;

        html += `
          <tr>
            <td class="text-center font-bold">${index + 1}</td>
            <td>${Utils.formatTanggal(item.tanggal)}</td>
            <td><strong>${periodMap[item.periode_id] || '-'}</strong></td>
            <td><span class="badge badge-secondary">${item.kategori || 'Lainnya'}</span></td>
            <td>${item.keterangan || '-'}</td>
            <td class="text-right font-bold text-danger">${Utils.formatRupiah(nominal)}</td>
            <td class="text-center">
              <div class="table-actions-cell">
                <button class="btn-icon-action btn-edit-pengeluaran" data-id="${item.id}" title="Edit Data" aria-label="Edit"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></button>
                <button class="btn-icon-action btn-action-danger btn-delete-pengeluaran" data-id="${item.id}" title="Hapus Data" aria-label="Hapus"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
              </div>
            </td>
          </tr>
        `;
      });

      tbody.innerHTML = html;
      if (totalNominalEl) totalNominalEl.textContent = Utils.formatRupiah(totalExpenseSum);

      // Event handlers for Edit & Delete buttons
      tbody.querySelectorAll('.btn-edit-pengeluaran').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = parseInt(btn.getAttribute('data-id'), 10);
          this.editPengeluaran(id);
        });
      });

      tbody.querySelectorAll('.btn-delete-pengeluaran').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = parseInt(btn.getAttribute('data-id'), 10);
          window.customConfirm('Hapus Pengeluaran', 'Apakah Anda yakin ingin menghapus data pengeluaran ini?', 'danger').then(async (confirmed) => { if (confirmed) {
            await this.db.delete('pengeluaran', id);
            this.state.pengeluaranList = await this.db.getAll('pengeluaran');
            Utils.showToast('Data berhasil dihapus.', 'success');
            this.renderPengeluaran();
          }});
        });
      });
    },

    editPengeluaran(id) {
      const exp = this.state.pengeluaranList.find(e => e.id === id);
      if (!exp) return;

      this.populatePengeluaranModalDropdowns();

      document.getElementById('pengeluaran-id').value = exp.id;
      document.getElementById('pengeluaran-tanggal').value = exp.tanggal || Utils.getTodayISO();
      document.getElementById('pengeluaran-periode-id').value = exp.periode_id;
      document.getElementById('pengeluaran-kategori').value = exp.kategori;
      document.getElementById('pengeluaran-keterangan').value = exp.keterangan || '';
      document.getElementById('pengeluaran-nominal').value = (Number(exp.nominal) || 0).toLocaleString('id-ID');

      document.getElementById('modal-pengeluaran-title').textContent = 'EDIT PENGELUARAN';
      document.getElementById('btn-hapus-pengeluaran-modal').classList.remove('hidden');

      this.openModal('modal-pengeluaran');
    },

    async savePengeluaran() {
      const expId = document.getElementById('pengeluaran-id').value;
      const tanggal = document.getElementById('pengeluaran-tanggal').value;
      const periodeId = parseInt(document.getElementById('pengeluaran-periode-id').value, 10);
      const kategori = document.getElementById('pengeluaran-kategori').value;
      const keterangan = document.getElementById('pengeluaran-keterangan').value.trim();
      const nominal = Utils.parseRupiah(document.getElementById('pengeluaran-nominal').value);

      if (!tanggal || !periodeId || !kategori || !keterangan) {
        window.customAlert('Peringatan', 'Mohon lengkapi seluruh kolom formulir.', 'warning'); return;
        return;
      }

      if (nominal <= 0) {
        window.customAlert('Peringatan', 'Nominal pengeluaran harus lebih dari Rp0.', 'warning'); return;
        return;
      }

      const now = new Date().toISOString();

      if (expId) {
        // Update
        const item = {
          id: parseInt(expId, 10),
          tanggal,
          periode_id: periodeId,
          kategori,
          keterangan,
          nominal,
          updated_at: now
        };
        await this.db.put('pengeluaran', item);
        Utils.showToast('Data berhasil diperbarui.', 'success');
      } else {
        // Add
        const item = {
          tanggal,
          periode_id: periodeId,
          kategori,
          keterangan,
          nominal,
          created_at: now,
          updated_at: now
        };
        await this.db.add('pengeluaran', item);
        Utils.showToast('Data berhasil disimpan.', 'success');
      }

      this.state.pengeluaranList = await this.db.getAll('pengeluaran');
      this.closeModal('modal-pengeluaran');
      this.renderCurrentView();
    },

    // ==========================================
    // 9. DATA SISWA VIEW
    // ==========================================
    renderSiswa() {
      const searchBox = document.getElementById('search-siswa-nama');
      const filterStatus = document.getElementById('filter-siswa-status');
      const countSummary = document.getElementById('count-siswa-summary');
      const tbody = document.getElementById('tbody-siswa');
      const emptyState = document.getElementById('empty-state-siswa');

      const searchQuery = searchBox ? searchBox.value.toLowerCase().trim() : '';
      const statusFilter = filterStatus ? filterStatus.value : 'ALL';

      let list = [...this.state.siswaList];

      if (searchQuery) {
        list = list.filter(s => s.nama.toLowerCase().includes(searchQuery));
      }

      if (statusFilter !== 'ALL') {
        list = list.filter(s => s.status === statusFilter);
      }

      // Sort alphabetically
      list.sort((a, b) => a.nama.localeCompare(b.nama));

      if (countSummary) {
        const activeCount = this.state.siswaList.filter(s => s.status === 'Aktif').length;
        countSummary.textContent = `${activeCount} Aktif / ${this.state.siswaList.length} Total`;
      }

      if (!tbody) return;

      if (list.length === 0) {
        tbody.innerHTML = '';
        if (emptyState) emptyState.classList.remove('hidden');
        return;
      }

      if (emptyState) emptyState.classList.add('hidden');

      let html = '';
      list.forEach((s, index) => {
        const isAktif = s.status === 'Aktif';
        const statusBadge = isAktif
          ? '<span class="badge badge-success">Aktif</span>'
          : '<span class="badge badge-secondary">Nonaktif</span>';

        const toggleBtn = isAktif
          ? `<button class="btn-icon-action btn-action-warning btn-toggle-siswa" data-id="${s.id}" data-action="nonaktif" title="Nonaktifkan Siswa" aria-label="Nonaktifkan"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg></button>`
          : `<button class="btn-icon-action btn-action-success btn-toggle-siswa" data-id="${s.id}" data-action="aktif" title="Aktifkan Siswa" aria-label="Aktifkan"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></button>`;

        html += `
          <tr>
            <td class="text-center font-bold">${index + 1}</td>
            <td class="font-bold">${s.nama}</td>
            <td class="text-center">${statusBadge}</td>
            <td>${s.keterangan || '-'}</td>
            <td class="text-center">
              <div class="table-actions-cell">
                <button class="btn-icon-action btn-edit-siswa" data-id="${s.id}" title="Edit Siswa" aria-label="Edit"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></button>
                ${toggleBtn}
              </div>
            </td>
          </tr>
        `;
      });

      tbody.innerHTML = html;

      // Event Listeners
      tbody.querySelectorAll('.btn-edit-siswa').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = parseInt(btn.getAttribute('data-id'), 10);
          this.editSiswa(id);
        });
      });

      tbody.querySelectorAll('.btn-toggle-siswa').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = parseInt(btn.getAttribute('data-id'), 10);
          const action = btn.getAttribute('data-action');
          const newStatus = action === 'nonaktif' ? 'Nonaktif' : 'Aktif';

          const siswa = this.state.siswaList.find(s => s.id === id);
          if (siswa) {
            siswa.status = newStatus;
            await this.db.put('siswa', siswa);
            this.state.siswaList = await this.db.getAll('siswa');
            Utils.showToast(`Status siswa diubah menjadi ${newStatus}.`, 'success');
            this.renderSiswa();
          }
        });
      });
    },

    editSiswa(id) {
      const s = this.state.siswaList.find(item => item.id === id);
      if (!s) return;

      document.getElementById('siswa-id').value = s.id;
      document.getElementById('siswa-nama').value = s.nama;
      document.getElementById('siswa-status').value = s.status || 'Aktif';
      document.getElementById('siswa-keterangan').value = s.keterangan || '';
      document.getElementById('modal-siswa-title').textContent = 'EDIT DATA SISWA';

      this.openModal('modal-siswa');
    },

    async saveSiswa() {
      const siswaId = document.getElementById('siswa-id').value;
      const nama = document.getElementById('siswa-nama').value.trim();
      const status = document.getElementById('siswa-status').value;
      const keterangan = document.getElementById('siswa-keterangan').value.trim();

      if (!nama) {
        window.customAlert('Peringatan', 'Nama siswa wajib diisi.', 'warning');
        return;
      }

      // Check for exact duplicate student name (case-insensitive)
      const duplicate = this.state.siswaList.find(
        s => s.nama.toLowerCase().trim() === nama.toLowerCase() && String(s.id) !== String(siswaId)
      );

      if (duplicate) {
        window.customAlert('Nama Sudah Terdaftar', `Siswa dengan nama "${duplicate.nama}" sudah ada dalam data. Harap gunakan nama lain atau berikan pembeda (misal: "Budi A", "Budi B").`, 'warning');
        return;
      }

      if (siswaId) {
        const item = {
          id: parseInt(siswaId, 10),
          nama,
          status,
          keterangan
        };
        await this.db.put('siswa', item);
        Utils.showToast('Data berhasil diperbarui.', 'success');
      } else {
        const item = {
          nama,
          status,
          keterangan
        };
        await this.db.add('siswa', item);
        Utils.showToast('Data berhasil disimpan.', 'success');
      }

      this.state.siswaList = await this.db.getAll('siswa');
      this.closeModal('modal-siswa');
      this.renderCurrentView();
    },

    // ==========================================
    // 10. PERIODE VIEW
    // ==========================================
    renderPeriode() {
      const countSummary = document.getElementById('count-periode-summary');
      const tbody = document.getElementById('tbody-periode');
      const emptyState = document.getElementById('empty-state-periode');

      const list = [...this.state.periodeList].sort((a, b) => (a.urutan || 0) - (b.urutan || 0));

      if (countSummary) {
        countSummary.textContent = `${list.length} Periode Terdaftar`;
      }

      if (!tbody) return;

      if (list.length === 0) {
        tbody.innerHTML = '';
        if (emptyState) emptyState.classList.remove('hidden');
        return;
      }

      if (emptyState) emptyState.classList.add('hidden');

      let html = '';
      list.forEach((p) => {
        const isAktif = p.aktif !== false;
        const statusBadge = isAktif
          ? '<span class="badge badge-success">Aktif</span>'
          : '<span class="badge badge-secondary">Nonaktif</span>';

        html += `
          <tr>
            <td class="text-center font-bold">${p.urutan || '-'}</td>
            <td class="font-bold">${p.nama_periode || p.bulan + ' ' + p.tahun}</td>
            <td class="text-center">${p.bulan}</td>
            <td class="text-center">${p.tahun}</td>
            <td class="text-center">${statusBadge}</td>
            <td class="text-center">
              <div class="table-actions-cell">
                <button class="btn-icon-action btn-edit-periode" data-id="${p.id}" title="Edit Periode" aria-label="Edit"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></button>
                <button class="btn-icon-action btn-action-danger btn-delete-periode" data-id="${p.id}" title="Hapus Periode" aria-label="Hapus"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
              </div>
            </td>
          </tr>
        `;
      });

      tbody.innerHTML = html;

      // Event handlers
      tbody.querySelectorAll('.btn-edit-periode').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = parseInt(btn.getAttribute('data-id'), 10);
          this.editPeriode(id);
        });
      });

      tbody.querySelectorAll('.btn-delete-periode').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = parseInt(btn.getAttribute('data-id'), 10);
          // Check if transactions exist
          const hasIncome = this.state.pemasukanList.some(p => String(p.periode_id) === String(id));
          const hasExpense = this.state.pengeluaranList.some(p => String(p.periode_id) === String(id));

          if (hasIncome || hasExpense) {
            window.customAlert('Tidak Dapat Dihapus', 'Periode ini memiliki transaksi terkait. Nonaktifkan periode jika tidak ingin ditampilkan.', 'warning');
            return;
          }

          window.customConfirm('Hapus Periode', 'Apakah Anda yakin ingin menghapus periode ini?', 'danger').then(async (confirmed) => { if (confirmed) {
            await this.db.delete('periode', id);
            this.state.periodeList = await this.db.getAll('periode');
            Utils.showToast('Data berhasil dihapus.', 'success');
            this.renderPeriode();
          }});
        });
      });
    },

    editPeriode(id) {
      const p = this.state.periodeList.find(item => item.id === id);
      if (!p) return;

      document.getElementById('periode-id').value = p.id;
      document.getElementById('periode-bulan').value = p.bulan;
      document.getElementById('periode-tahun').value = p.tahun;
      document.getElementById('periode-urutan').value = p.urutan || 1;
      document.getElementById('periode-aktif').checked = (p.aktif !== false);
      document.getElementById('modal-periode-title').textContent = 'EDIT PERIODE';

      this.openModal('modal-periode');
    },

    async savePeriode() {
      const periodeId = document.getElementById('periode-id').value;
      const bulan = document.getElementById('periode-bulan').value;
      const tahun = parseInt(document.getElementById('periode-tahun').value, 10);
      const urutan = parseInt(document.getElementById('periode-urutan').value, 10);
      const aktif = document.getElementById('periode-aktif').checked;

      if (!bulan || !tahun || isNaN(urutan)) {
        window.customAlert('Peringatan', 'Mohon lengkapi seluruh formulir periode.', 'warning'); return;
        return;
      }

      const nama_periode = `${bulan} ${tahun}`;

      if (periodeId) {
        const item = {
          id: parseInt(periodeId, 10),
          bulan,
          tahun,
          nama_periode,
          urutan,
          aktif
        };
        await this.db.put('periode', item);
        Utils.showToast('Data berhasil diperbarui.', 'success');
      } else {
        const item = {
          bulan,
          tahun,
          nama_periode,
          urutan,
          aktif
        };
        await this.db.add('periode', item);
        Utils.showToast('Data berhasil disimpan.', 'success');
      }

      const list = await this.db.getAll('periode');
      this.state.periodeList = list.sort((a, b) => (a.urutan || 0) - (b.urutan || 0));
      this.closeModal('modal-periode');
      this.renderCurrentView();
    },

    // ==========================================
    // 11. CETAK LAPORAN & STANDALONE PDF EXPORT
    // ==========================================
    renderCetakView() {
      // Populate select print period
      const selectPeriode = document.getElementById('select-print-periode');
      if (selectPeriode) {
        const sorted = [...this.state.periodeList].sort((a, b) => (a.urutan || 0) - (b.urutan || 0));
        selectPeriode.innerHTML = '<option value="ALL">Semua Periode</option>' +
          sorted.map(p => `<option value="${p.id}">${p.nama_periode || p.bulan + ' ' + p.tahun}</option>`).join('');
      }

      this.renderCetakPreview();
    },

    renderCetakPreview() {
      const reportType = document.querySelector('input[name="report_type"]:checked')?.value || 'ALL';
      const selectPeriode = document.getElementById('select-print-periode');
      const selectedPeriodId = selectPeriode ? selectPeriode.value : 'ALL';

      const prevDocInst = document.getElementById('prev-doc-institution');
      const prevDocSub = document.getElementById('prev-doc-sub');
      const prevDocClass = document.getElementById('prev-doc-class');
      const prevDocMeta = document.getElementById('prev-doc-meta');
      const prevDocContent = document.getElementById('prev-doc-content');

      const instName = this.state.settings.headerInstitution || 'REKAP KAS KELAS';
      const subTitle = this.state.settings.headerSub || '';
      const className = this.state.settings.className ? `KELAS ${this.state.settings.className.toUpperCase()}` : '';
      const addr = this.state.settings.headerAddress || '';

      let periodLabel = 'Semua Periode';
      if (selectedPeriodId !== 'ALL') {
        const p = this.state.periodeList.find(item => String(item.id) === selectedPeriodId);
        if (p) periodLabel = p.nama_periode || `${p.bulan} ${p.tahun}`;
      }

      if (prevDocInst) prevDocInst.textContent = instName.toUpperCase();
      if (prevDocSub) {
        prevDocSub.textContent = subTitle;
        prevDocSub.style.display = subTitle ? 'block' : 'none';
      }
      if (prevDocClass) prevDocClass.textContent = className;
      if (prevDocMeta) {
        prevDocMeta.textContent = `${addr ? addr + ' • ' : ''}Tahun Ajaran: ${this.state.settings.academicYear} • Periode: ${periodLabel}`;
      }

      if (!prevDocContent) return;

      let html = '';

      // ── Bagian 1: Global
      if (reportType === 'GLOBAL' || reportType === 'ALL') {
        const title1 = reportType === 'ALL' ? 'BAGIAN 1 — REKAP GLOBAL SALDO' : 'REKAP GLOBAL SALDO';
        const globalData = this.calculateRekapGlobal();
        let displayData = globalData;
        if (selectedPeriodId !== 'ALL') {
          displayData = displayData.filter(d => String(d.periode.id) === selectedPeriodId);
        }

        let totMasuk = 0, totKeluar = 0, lastSaldo = Number(this.state.settings.initialBalance) || 0;
        displayData.forEach(d => {
          totMasuk += Number(d.pemasukan) || 0;
          totKeluar += Number(d.pengeluaran) || 0;
          lastSaldo = Number(d.saldoAkhir) || 0;
        });

        html += `
          <div class="print-section mb-4">
            <h4 class="font-bold mb-2 text-primary" style="color: #215E61;">${title1}</h4>
            <div class="table-responsive">
              <table class="table table-bordered table-striped" style="font-size: 0.82rem;">
              <thead>
                <tr>
                  <th style="width:40px;" class="text-center">No</th>
                  <th>Bulan / Periode</th>
                  <th class="text-right">Saldo Awal</th>
                  <th class="text-right">Pemasukan</th>
                  <th class="text-right">Pengeluaran</th>
                  <th class="text-right">Saldo Akhir</th>
                </tr>
              </thead>
              <tbody>
                ${displayData.map((d, i) => `
                  <tr>
                    <td class="text-center font-bold">${i + 1}</td>
                    <td class="font-bold">${d.periode.nama_periode || d.periode.bulan + ' ' + d.periode.tahun}</td>
                    <td class="text-right">${Utils.formatRupiah(d.saldoAwal)}</td>
                    <td class="text-right font-bold text-success">+ ${Utils.formatRupiah(d.pemasukan)}</td>
                    <td class="text-right font-bold text-danger">- ${Utils.formatRupiah(d.pengeluaran)}</td>
                    <td class="text-right font-bold text-primary">${Utils.formatRupiah(d.saldoAkhir)}</td>
                  </tr>
                `).join('')}
              </tbody>
              <tfoot>
                <tr class="table-total-row">
                  <td colspan="3" class="text-center font-bold">TOTAL KESELURUHAN</td>
                  <td class="text-right font-bold">${Utils.formatRupiah(totMasuk)}</td>
                  <td class="text-right font-bold">${Utils.formatRupiah(totKeluar)}</td>
                  <td class="text-right font-bold">${Utils.formatRupiah(lastSaldo)}</td>
                </tr>
              </tfoot>
            </table>
            </div>
          </div>
        `;
      }

      // ── Bagian 2: Pemasukan
      if (reportType === 'PEMASUKAN' || reportType === 'ALL') {
        const title2 = reportType === 'ALL' ? 'BAGIAN 2 — REKAP PEMASUKAN SISWA' : 'REKAP PEMASUKAN SISWA';
        let periods = this.state.periodeList.filter(p => p.aktif !== false);
        if (selectedPeriodId !== 'ALL') {
          periods = periods.filter(p => String(p.id) === selectedPeriodId);
        }
        periods.sort((a, b) => (a.urutan || 0) - (b.urutan || 0));

        const paymentMap = this.getValidPaymentMap();

        const students = [...this.state.siswaList].sort((a, b) => a.nama.localeCompare(b.nama));
        const colTotals = {};
        periods.forEach(p => colTotals[p.id] = 0);
        let grandTotal = 0;

        html += `
          <div class="print-section mb-4">
            <h4 class="font-bold mb-2 text-primary" style="color: #215E61;">${title2}</h4>
            <div class="table-responsive">
              <table class="table table-bordered table-striped" style="font-size: 0.82rem;">
                <thead>
                  <tr>
                    <th style="width:40px;" class="text-center">No</th>
                    <th>Nama Siswa</th>
                    ${periods.map(p => `<th class="text-right">${p.bulan}</th>`).join('')}
                    <th class="text-right font-bold" style="min-width: 95px;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${students.map((s, i) => {
                    let sTotal = 0;
                    const cHtml = periods.map(p => {
                      const pay = paymentMap[`${s.id}_${p.id}`];
                      const val = pay ? (Number(pay.nominal) || 0) : 0;
                      sTotal += val;
                      colTotals[p.id] += val;
                      return `<td class="text-right">${pay ? Utils.formatRupiah(val) : '<span class="text-muted">-</span>'}</td>`;
                    }).join('');
                    grandTotal += sTotal;
                    return `
                      <tr>
                        <td class="text-center font-bold">${i + 1}</td>
                        <td class="font-bold">${s.nama}</td>
                        ${cHtml}
                        <td class="text-right font-bold text-primary">${Utils.formatRupiah(sTotal)}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
                <tfoot>
                  <tr class="table-total-row">
                    <td colspan="2" class="text-center font-bold">TOTAL PEMASUKAN</td>
                    ${periods.map(p => `<td class="text-right font-bold">${Utils.formatRupiah(colTotals[p.id])}</td>`).join('')}
                    <td class="text-right font-bold">${Utils.formatRupiah(grandTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        `;
      }

      // ── Bagian 3: Pengeluaran
      if (reportType === 'PENGELUARAN' || reportType === 'ALL') {
        const title3 = reportType === 'ALL' ? 'BAGIAN 3 — REKAP PENGELUARAN KAS' : 'REKAP PENGELUARAN KAS';
        let expList = [...this.state.pengeluaranList];
        if (selectedPeriodId !== 'ALL') {
          expList = expList.filter(item => String(item.periode_id) === selectedPeriodId);
        }
        expList.sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));

        const periodMap = {};
        this.state.periodeList.forEach(p => periodMap[p.id] = p.nama_periode || `${p.bulan} ${p.tahun}`);

        let expTotal = 0;

        html += `
          <div class="print-section mb-4">
            <h4 class="font-bold mb-2 text-primary" style="color: #215E61;">${title3}</h4>
            <div class="table-responsive">
              <table class="table table-bordered table-striped" style="font-size: 0.82rem;">
              <thead>
                <tr>
                  <th style="width:40px;" class="text-center">No</th>
                  <th style="width:95px;" class="text-center">Tanggal</th>
                  <th>Periode</th>
                  <th>Kategori</th>
                  <th>Keterangan</th>
                  <th class="text-right" style="width:120px;">Nominal</th>
                </tr>
              </thead>
              <tbody>
                ${expList.map((e, i) => {
                  const nominal = Number(e.nominal) || 0;
                  expTotal += nominal;
                  return `
                    <tr>
                      <td class="text-center font-bold">${i + 1}</td>
                      <td class="text-center">${Utils.formatTanggal(e.tanggal)}</td>
                      <td>${periodMap[e.periode_id] || '-'}</td>
                      <td><span class="badge badge-secondary">${e.kategori || 'Umum'}</span></td>
                      <td>${e.keterangan || '-'}</td>
                      <td class="text-right font-bold text-danger">${Utils.formatRupiah(nominal)}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
              <tfoot>
                <tr class="table-total-row">
                  <td colspan="5" class="text-center font-bold">TOTAL PENGELUARAN</td>
                  <td class="text-right font-bold">${Utils.formatRupiah(expTotal)}</td>
                </tr>
              </tfoot>
            </table>
            </div>
          </div>
        `;
      }

      prevDocContent.innerHTML = html;
    },

    // ─── Clean Professional PDF Generator (jsPDF + AutoTable) ───────────
    async generatePdfReport() {
      try {
        // Lazy-load jsPDF if not yet loaded
        await ensureJsPDF();

        if (!window.jspdf || !window.jspdf.jsPDF) {
          window.customAlert('Informasi', 'Library PDF belum termuat. Menggunakan cetak browser...', 'info');
          this.triggerBrowserPrint();
          return;
        }

        const { jsPDF } = window.jspdf;
        const reportType = document.querySelector('input[name="report_type"]:checked')?.value || 'ALL';
        const selectPeriode = document.getElementById('select-print-periode');
        const selectedPeriodId = selectPeriode ? selectPeriode.value : 'ALL';

        let periodLabel = 'Semua Periode';
        let periodFileStr = 'Semua-Periode';
        if (selectedPeriodId !== 'ALL') {
          const p = this.state.periodeList.find(item => String(item.id) === selectedPeriodId);
          if (p) {
            periodLabel = p.nama_periode || `${p.bulan} ${p.tahun}`;
            periodFileStr = periodLabel.replace(/\s+/g, '-');
          }
        }

        let typeStr = 'Semua';
        if (reportType === 'GLOBAL') typeStr = 'Rekap_Global';
        else if (reportType === 'PEMASUKAN') typeStr = 'Pemasukan';
        else if (reportType === 'PENGELUARAN') typeStr = 'Pengeluaran';

        const classNameClean = (this.state.settings.className || 'Kelas').replace(/\s+/g, '_');
        const filename = `Laporan_Kas_${classNameClean}_${typeStr}_${periodFileStr}.pdf`;

        // ── Palet Warna Hijau Lumut & Putih Saja ────────────────────────────
        const CLR = {
          mossDark:   [33, 94, 97],     // #215E61 (Warna Utama Hijau)
          mossMid:    [33, 94, 97],     // #215E61 (Warna Hijau Utama)
          mossLight:  [234, 242, 242],  // #EAF2F2
          mossBorder: [163, 196, 198],  // #A3C4C6
          stripe:     [245, 248, 248],  // #F5F8F8
          white:      [255, 255, 255],  // #FFFFFF
          textDark:   [14, 40, 41],     // #0E2829
          textMuted:  [66, 102, 104]    // #426668
        };

        const autoTable = (docObj, options) => {
          if (typeof docObj.autoTable === 'function') {
            docObj.autoTable(options);
          } else if (window.jspdf && typeof window.jspdf.autoTable === 'function') {
            window.jspdf.autoTable(docObj, options);
          } else if (typeof window.autoTable === 'function') {
            window.autoTable(docObj, options);
          }
        };

        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pw = doc.internal.pageSize.getWidth();
        const ph = doc.internal.pageSize.getHeight();

        // ── Helper: draw formal kop surat resmi (tanpa background tebal, dengan garis ganda rapi)
        const drawHeader = (sectionTitle) => {
          const instName = (this.state.settings.headerInstitution || 'REKAP KAS KELAS').toUpperCase();
          const subTitle = this.state.settings.headerSub || '';
          const className = `KELAS ${(this.state.settings.className || '').toUpperCase()}`;
          const addr = this.state.settings.headerAddress || '';

          let curY = 12;

          // 1. Nama Sekolah / Lembaga
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(12);
          doc.setTextColor(...CLR.mossMid);
          doc.text(instName, pw / 2, curY, { align: 'center' });
          curY += 6;

          // 2. Sub-Judul Lembaga jika ada
          if (subTitle) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(...CLR.textDark);
            doc.text(subTitle, pw / 2, curY, { align: 'center' });
            curY += 5;
          }

          // 3. Nama Kelas
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(12);
          doc.setTextColor(...CLR.textDark);
          doc.text(className, pw / 2, curY, { align: 'center' });
          curY += 5.5;

          // 4. Baris Info & Alamat
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(...CLR.textMuted);
          const metaText = `${addr ? addr + '   |   ' : ''}Tahun Ajaran: ${this.state.settings.academicYear || '-'}   |   Periode: ${periodLabel}   |   Dicetak: ${new Date().toLocaleDateString('id-ID')}`;
          doc.text(metaText, pw / 2, curY, { align: 'center' });
          curY += 4.5;

          // 5. Garis Pembatas Kop Surat Resmi (Garis Ganda Rapi: Garis Tebal + Garis Tipis)
          doc.setDrawColor(...CLR.mossMid);
          doc.setLineWidth(0.8);
          doc.line(12, curY, pw - 12, curY);

          doc.setLineWidth(0.25);
          doc.line(12, curY + 1.2, pw - 12, curY + 1.2);
          curY += 6;

          // 6. Section Title Pill (Hijau Lumut & Putih)
          if (sectionTitle) {
            doc.setFillColor(...CLR.mossLight);
            doc.roundedRect(12, curY, pw - 24, 7.5, 1.5, 1.5, 'F');
            doc.setDrawColor(...CLR.mossMid);
            doc.setLineWidth(0.3);
            doc.roundedRect(12, curY, pw - 24, 7.5, 1.5, 1.5, 'S');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(...CLR.mossDark);
            doc.text(sectionTitle, pw / 2, curY + 5.2, { align: 'center' });
            curY += 12;
          }

          return curY;
        };

        // ── Base autoTable config ──────────────────────────────────────────
        const baseTable = (extra) => ({
          theme: 'grid',
          margin: { top: 12, bottom: 14, left: 12, right: 12 },
          styles: {
            font: 'helvetica',
            fontSize: 7.5,
            cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
            lineColor: CLR.mossBorder,
            lineWidth: 0.2,
            textColor: CLR.textDark,
            overflow: 'linebreak'
          },
          headStyles: {
            fillColor: CLR.mossDark,
            textColor: CLR.white,
            fontStyle: 'bold',
            fontSize: 8,
            halign: 'center',
            valign: 'middle',
            lineColor: CLR.mossDark,
            lineWidth: 0.3
          },
          footStyles: {
            fillColor: CLR.mossDark,
            textColor: CLR.white,
            fontStyle: 'bold',
            fontSize: 8,
            lineColor: CLR.mossDark,
            lineWidth: 0.3
          },
          alternateRowStyles: {
            fillColor: CLR.stripe
          },
          ...extra
        });

        // ── SECTION 1: REKAP GLOBAL SALDO ──────────────────────────────────
        if (reportType === 'GLOBAL' || reportType === 'ALL') {
          const title1 = reportType === 'ALL' ? 'BAGIAN 1 — REKAP GLOBAL SALDO' : 'REKAP GLOBAL SALDO';
          let y = drawHeader(title1);

          const globalData = this.calculateRekapGlobal();
          let displayData = globalData;
          if (selectedPeriodId !== 'ALL') {
            displayData = displayData.filter(d => String(d.periode.id) === selectedPeriodId);
          }

          const summaryHead = [['No', 'Bulan / Periode', 'Saldo Awal', 'Pemasukan', 'Pengeluaran', 'Saldo Akhir']];
          const summaryBody = [];
          let totMasuk = 0, totKeluar = 0, lastSaldo = Number(this.state.settings.initialBalance) || 0;

          displayData.forEach((d, idx) => {
            const masuk = Number(d.pemasukan) || 0;
            const keluar = Number(d.pengeluaran) || 0;
            totMasuk += masuk;
            totKeluar += keluar;
            lastSaldo = Number(d.saldoAkhir) || 0;

            summaryBody.push([
              { content: String(idx + 1), styles: { halign: 'center' } },
              { content: d.periode.nama_periode || `${d.periode.bulan} ${d.periode.tahun}`, styles: { fontStyle: 'bold' } },
              { content: Utils.formatRupiah(d.saldoAwal), styles: { halign: 'right' } },
              { content: Utils.formatRupiah(d.pemasukan), styles: { halign: 'right', fontStyle: 'bold' } },
              { content: Utils.formatRupiah(d.pengeluaran), styles: { halign: 'right', fontStyle: 'bold' } },
              { content: Utils.formatRupiah(d.saldoAkhir), styles: { halign: 'right', fontStyle: 'bold' } }
            ]);
          });

          const summaryFoot = [[
            { content: 'TOTAL KESELURUHAN', colSpan: 3, styles: { halign: 'center', fontStyle: 'bold' } },
            { content: Utils.formatRupiah(totMasuk), styles: { halign: 'right', fontStyle: 'bold' } },
            { content: Utils.formatRupiah(totKeluar), styles: { halign: 'right', fontStyle: 'bold' } },
            { content: Utils.formatRupiah(lastSaldo), styles: { halign: 'right', fontStyle: 'bold' } }
          ]];

          autoTable(doc, baseTable({
            startY: y,
            head: summaryHead,
            body: summaryBody,
            foot: summaryFoot,
            columnStyles: {
              0: { cellWidth: 12 },
              1: { cellWidth: 46 },
              2: { cellWidth: 32 },
              3: { cellWidth: 32 },
              4: { cellWidth: 32 },
              5: { cellWidth: 32 }
            }
          }));
        }

        // ── SECTION 2: REKAP PEMASUKAN MATRIKS ──────────────────────────────
        if (reportType === 'PEMASUKAN' || reportType === 'ALL') {
          const title2 = reportType === 'ALL' ? 'BAGIAN 2 — REKAP PEMASUKAN SISWA' : 'REKAP PEMASUKAN SISWA';
          let y;
          if (reportType === 'ALL') {
            doc.addPage();
            y = drawHeader(title2);
          } else {
            y = drawHeader(title2);
          }

          let periods = this.state.periodeList.filter(p => p.aktif !== false);
          if (selectedPeriodId !== 'ALL') {
            periods = periods.filter(p => String(p.id) === selectedPeriodId);
          }
          periods.sort((a, b) => (a.urutan || 0) - (b.urutan || 0));

          const paymentMap = this.getValidPaymentMap();

          const students = [...this.state.siswaList].sort((a, b) => a.nama.localeCompare(b.nama));
          const matrixHead = [['No', 'Nama Siswa', ...periods.map(p => p.bulan), 'Total']];
          const matrixBody = [];
          const colTotals = {};
          periods.forEach(p => { colTotals[p.id] = 0; });
          let grandTotal = 0;

          students.forEach((s, idx) => {
            let rowTotal = 0;
            const row = [
              { content: String(idx + 1), styles: { halign: 'center', fontSize: 7 } },
              { content: s.nama, styles: { fontStyle: 'bold', fontSize: 7.5 } }
            ];

            periods.forEach(p => {
              const pay = paymentMap[`${s.id}_${p.id}`];
              const val = pay ? (Number(pay.nominal) || 0) : 0;
              rowTotal += val;
              colTotals[p.id] += val;

              if (pay) {
                row.push({ content: Utils.formatRupiah(val), styles: { halign: 'right', fontSize: 7 } });
              } else {
                row.push({ content: '-', styles: { halign: 'center', textColor: CLR.textMuted, fontSize: 7 } });
              }
            });

            grandTotal += rowTotal;
            row.push({ content: Utils.formatRupiah(rowTotal), styles: { halign: 'right', fontStyle: 'bold', fillColor: CLR.mossLight, fontSize: 7.5 } });
            matrixBody.push(row);
          });

          const matrixFoot = [[
            { content: 'TOTAL PEMASUKAN', colSpan: 2, styles: { halign: 'center', fontStyle: 'bold' } },
            ...periods.map(p => ({ content: Utils.formatRupiah(colTotals[p.id]), styles: { halign: 'right', fontStyle: 'bold' } })),
            { content: Utils.formatRupiah(grandTotal), styles: { halign: 'right', fontStyle: 'bold' } }
          ]];

          autoTable(doc, baseTable({
            startY: y,
            head: matrixHead,
            body: matrixBody,
            foot: matrixFoot,
            columnStyles: {
              0: { cellWidth: 10 },
              1: { cellWidth: 42 }
            }
          }));
        }

        // ── SECTION 3: REKAP PENGELUARAN ──────────────────────────────────
        if (reportType === 'PENGELUARAN' || reportType === 'ALL') {
          const title3 = reportType === 'ALL' ? 'BAGIAN 3 — REKAP PENGELUARAN KAS' : 'REKAP PENGELUARAN KAS';
          let y;
          if (reportType === 'ALL') {
            doc.addPage();
            y = drawHeader(title3);
          } else {
            y = drawHeader(title3);
          }

          const periodMap = {};
          this.state.periodeList.forEach(p => { periodMap[p.id] = p.nama_periode || `${p.bulan} ${p.tahun}`; });

          let expList = [...this.state.pengeluaranList];
          if (selectedPeriodId !== 'ALL') {
            expList = expList.filter(item => String(item.periode_id) === selectedPeriodId);
          }
          expList.sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));

          const expHead = [['No', 'Tanggal', 'Periode', 'Kategori', 'Keterangan', 'Nominal']];
          const expBody = [];
          let expTotal = 0;

          expList.forEach((e, idx) => {
            const nominal = Number(e.nominal) || 0;
            expTotal += nominal;
            expBody.push([
              { content: String(idx + 1), styles: { halign: 'center' } },
              { content: Utils.formatTanggal(e.tanggal), styles: { halign: 'center' } },
              { content: periodMap[e.periode_id] || '-', styles: { halign: 'center' } },
              { content: e.kategori || 'Umum', styles: { halign: 'center', fontStyle: 'bold' } },
              { content: e.keterangan || '-' },
              { content: Utils.formatRupiah(nominal), styles: { halign: 'right', fontStyle: 'bold' } }
            ]);
          });

          const expFoot = [[
            { content: 'TOTAL PENGELUARAN', colSpan: 5, styles: { halign: 'center', fontStyle: 'bold' } },
            { content: Utils.formatRupiah(expTotal), styles: { halign: 'right', fontStyle: 'bold' } }
          ]];

          autoTable(doc, baseTable({
            startY: y,
            head: expHead,
            body: expBody,
            foot: expFoot,
            columnStyles: {
              0: { cellWidth: 10 },
              1: { cellWidth: 26 },
              2: { cellWidth: 30 },
              3: { cellWidth: 30 },
              4: { cellWidth: 55 },
              5: { cellWidth: 35 }
            }
          }));
        }

        // ── Helper: add page footers across all pages ──────────────────────
        const total = doc.internal.getNumberOfPages();
        for (let pg = 1; pg <= total; pg++) {
          doc.setPage(pg);

          // Footer
          doc.setDrawColor(...CLR.mossBorder);
          doc.setLineWidth(0.3);
          doc.line(12, ph - 9, pw - 12, ph - 9);

          doc.setFillColor(...CLR.mossDark);
          doc.rect(0, ph - 6, pw, 6, 'F');

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6.5);
          doc.setTextColor(...CLR.mossLight);
          doc.text(`Rekap Kas Kelas ${this.state.settings.className || ''} — Dokumen Laporan Kas Resmi`, 12, ph - 2.2);

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          doc.setTextColor(...CLR.white);
          doc.text(`Halaman ${pg} dari ${total}`, pw - 12, ph - 2.2, { align: 'right' });
        }

        doc.save(filename);
        Utils.showToast('Laporan PDF berhasil diunduh.', 'success');
      } catch (err) {
        console.error('PDF Generation Error:', err);
        Utils.showToast('Gagal membuat PDF: ' + err.message, 'danger');
      }
    },

    triggerBrowserPrint() {
      const reportType = document.querySelector('input[name="report_type"]:checked')?.value || 'ALL';
      const selectPeriode = document.getElementById('select-print-periode');
      const selectedPeriodId = selectPeriode ? selectPeriode.value : 'ALL';

      let periodLabel = 'Semua Periode';
      if (selectedPeriodId !== 'ALL') {
        const p = this.state.periodeList.find(item => String(item.id) === selectedPeriodId);
        if (p) periodLabel = p.nama_periode || `${p.bulan} ${p.tahun}`;
      }

      const printContent = this.buildPrintHtml(reportType, selectedPeriodId, periodLabel);
      const printWin = window.open('', '_blank', 'width=960,height=700');
      if (!printWin) {
        window.customAlert('Popup Diblokir', 'Popup diblokir browser. Izinkan popup untuk fungsi cetak langsung.', 'warning');
        return;
      }
      printWin.document.write(printContent);
      printWin.document.close();
      setTimeout(() => { printWin.focus(); printWin.print(); }, 600);
    },

    buildPrintHtml(reportType, selectedPeriodId, periodLabel) {
      const cls = this.state.settings.className;
      const yr = this.state.settings.academicYear;
      const now = new Date().toLocaleString('id-ID');

      const globalData = this.calculateRekapGlobal();
      let periodsAll = this.state.periodeList.filter(p => p.aktif !== false);
      if (selectedPeriodId !== 'ALL') periodsAll = periodsAll.filter(p => String(p.id) === selectedPeriodId);
      periodsAll.sort((a, b) => (a.urutan || 0) - (b.urutan || 0));

      const paymentMap = this.getValidPaymentMap();
      const students = [...this.state.siswaList].sort((a, b) => a.nama.localeCompare(b.nama));
      const periodMap = {};
      this.state.periodeList.forEach(p => periodMap[p.id] = p.nama_periode || `${p.bulan} ${p.tahun}`);

      const instName = (this.state.settings.headerInstitution || 'REKAP KAS KELAS').toUpperCase();
      const subTitle = this.state.settings.headerSub || '';
      const addr = this.state.settings.headerAddress || '';

      const docHeader = `
        <div class="doc-header-kop" style="text-align: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2.5px solid #215E61; position: relative;">
          <div style="font-size: 13pt; font-weight: bold; color: #215E61; letter-spacing: 0.5px; margin-bottom: 4px;">${instName}</div>
          ${subTitle ? `<div style="font-size: 9.5pt; font-weight: bold; color: #0e2829; margin-bottom: 4px;">${subTitle}</div>` : ''}
          <div style="font-size: 11.5pt; font-weight: bold; color: #0e2829; margin-bottom: 5px;">KELAS ${cls.toUpperCase()}</div>
          <div style="font-size: 8pt; color: #426668; margin-top: 4px; line-height: 1.4;">
            ${addr ? addr + ' &nbsp;|&nbsp; ' : ''}Tahun Ajaran: ${yr} &nbsp;|&nbsp; Periode: ${periodLabel} &nbsp;|&nbsp; Dicetak: ${now}
          </div>
          <div style="position: absolute; bottom: -5px; left: 0; right: 0; border-bottom: 0.8px solid #215E61;"></div>
        </div>
      `;

      let body = '';

      if (reportType === 'GLOBAL' || reportType === 'ALL') {
        const title1 = reportType === 'ALL' ? 'BAGIAN 1 — REKAP GLOBAL SALDO' : 'REKAP GLOBAL SALDO';
        let dispData = globalData;
        if (selectedPeriodId !== 'ALL') dispData = dispData.filter(d => String(d.periode.id) === selectedPeriodId);
        let totInc = 0, totExp = 0, lastBal = Number(this.state.settings.initialBalance) || 0;
        dispData.forEach(d => {
          totInc += Number(d.pemasukan) || 0;
          totExp += Number(d.pengeluaran) || 0;
          lastBal = Number(d.saldoAkhir) || 0;
        });

        body += `
          <div class="section" style="margin-bottom: 16px;">
            <div style="background: #eaf2f2; color: #215E61; padding: 6px 10px; font-weight: bold; font-size: 9pt; border: 1px solid #215E61; border-radius: 3px; margin-bottom: 6px;">${title1}</div>
            <table style="width: 100%; border-collapse: collapse; font-size: 8pt;">
              <thead>
                <tr style="background: #215E61; color: #fff;">
                  <th style="padding: 5px; border: 1px solid #d2ddd5;">No</th>
                  <th style="padding: 5px; border: 1px solid #d2ddd5;">Bulan / Periode</th>
                  <th style="padding: 5px; border: 1px solid #d2ddd5; text-align: right;">Saldo Awal</th>
                  <th style="padding: 5px; border: 1px solid #d2ddd5; text-align: right;">Pemasukan</th>
                  <th style="padding: 5px; border: 1px solid #d2ddd5; text-align: right;">Pengeluaran</th>
                  <th style="padding: 5px; border: 1px solid #d2ddd5; text-align: right;">Saldo Akhir</th>
                </tr>
              </thead>
              <tbody>
                ${dispData.map((d, i) => `
                  <tr style="background: ${i % 2 === 0 ? '#fff' : '#f7faf8'};">
                    <td style="padding: 4px; border: 1px solid #d2ddd5; text-align: center;">${i + 1}</td>
                    <td style="padding: 4px; border: 1px solid #d2ddd5;"><b>${d.periode.nama_periode || d.periode.bulan + ' ' + d.periode.tahun}</b></td>
                    <td style="padding: 4px; border: 1px solid #d2ddd5; text-align: right;">${Utils.formatRupiah(d.saldoAwal)}</td>
                    <td style="padding: 4px; border: 1px solid #d2ddd5; text-align: right; font-weight: bold;">${Utils.formatRupiah(d.pemasukan)}</td>
                    <td style="padding: 4px; border: 1px solid #d2ddd5; text-align: right; font-weight: bold;">${Utils.formatRupiah(d.pengeluaran)}</td>
                    <td style="padding: 4px; border: 1px solid #d2ddd5; text-align: right; font-weight: bold;">${Utils.formatRupiah(d.saldoAkhir)}</td>
                  </tr>
                `).join('')}
              </tbody>
              <tfoot>
                <tr style="background: #215E61; color: #fff; font-weight: bold;">
                  <td colspan="3" style="padding: 5px; text-align: center; border: 1px solid #215E61;">TOTAL KESELURUHAN</td>
                  <td style="padding: 5px; text-align: right; border: 1px solid #215E61;">${Utils.formatRupiah(totInc)}</td>
                  <td style="padding: 5px; text-align: right; border: 1px solid #215E61;">${Utils.formatRupiah(totExp)}</td>
                  <td style="padding: 5px; text-align: right; border: 1px solid #215E61;">${Utils.formatRupiah(lastBal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>`;
      }

      if (reportType === 'PEMASUKAN' || reportType === 'ALL') {
        const title2 = reportType === 'ALL' ? 'BAGIAN 2 — REKAP PEMASUKAN SISWA' : 'REKAP PEMASUKAN SISWA';
        const colTotals = {};
        periodsAll.forEach(p => colTotals[p.id] = 0);
        let grandTotal = 0;

        body += `
          <div class="section${reportType === 'ALL' ? ' pgbreak' : ''}" style="margin-bottom: 16px;">
            <div style="background: #eaf2f2; color: #215E61; padding: 6px 10px; font-weight: bold; font-size: 9pt; border: 1px solid #215E61; border-radius: 3px; margin-bottom: 6px;">${title2}</div>
            <table style="width: 100%; border-collapse: collapse; font-size: 7.5pt;">
              <thead>
                <tr style="background: #215E61; color: #fff;">
                  <th style="padding: 4px; border: 1px solid #d2ddd5;">No</th>
                  <th style="padding: 4px; border: 1px solid #d2ddd5;">Nama Siswa</th>
                  ${periodsAll.map(p => `<th style="padding: 4px; border: 1px solid #d2ddd5; text-align: right;">${p.bulan}</th>`).join('')}
                  <th style="padding: 4px; border: 1px solid #d2ddd5; text-align: right;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${students.map((s, i) => {
                  let sTotal = 0;
                  const cells = periodsAll.map(p => {
                    const pay = paymentMap[`${s.id}_${p.id}`];
                    const val = pay ? Number(pay.nominal) || 0 : 0;
                    sTotal += val; colTotals[p.id] += val;
                    return `<td style="padding: 3px; border: 1px solid #d2ddd5; text-align: right;">${pay ? Utils.formatRupiah(val) : '-'}</td>`;
                  }).join('');
                  grandTotal += sTotal;
                  return `<tr style="background: ${i % 2 === 0 ? '#fff' : '#f7faf8'};">
                            <td style="padding: 3px; border: 1px solid #d2ddd5; text-align: center;">${i + 1}</td>
                            <td style="padding: 3px; border: 1px solid #d2ddd5;"><b>${s.nama}</b></td>
                            ${cells}
                            <td style="padding: 3px; border: 1px solid #d2ddd5; text-align: right; font-weight: bold; background: #eaf2f2;">${Utils.formatRupiah(sTotal)}</td>
                          </tr>`;
                }).join('')}
              </tbody>
              <tfoot>
                <tr style="background: #215E61; color: #fff; font-weight: bold;">
                  <td colspan="2" style="padding: 4px; text-align: center; border: 1px solid #215E61;">TOTAL PEMASUKAN</td>
                  ${periodsAll.map(p => `<td style="padding: 4px; text-align: right; border: 1px solid #215E61;">${Utils.formatRupiah(colTotals[p.id])}</td>`).join('')}
                  <td style="padding: 4px; text-align: right; border: 1px solid #215E61;">${Utils.formatRupiah(grandTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>`;
      }

      if (reportType === 'PENGELUARAN' || reportType === 'ALL') {
        const title3 = reportType === 'ALL' ? 'BAGIAN 3 — REKAP PENGELUARAN KAS' : 'REKAP PENGELUARAN KAS';
        let expList = [...this.state.pengeluaranList];
        if (selectedPeriodId !== 'ALL') expList = expList.filter(item => String(item.periode_id) === selectedPeriodId);
        expList.sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));
        let expTotal = 0;

        body += `
          <div class="section${reportType === 'ALL' ? ' pgbreak' : ''}" style="margin-bottom: 16px;">
            <div style="background: #eaf2f2; color: #215E61; padding: 6px 10px; font-weight: bold; font-size: 9pt; border: 1px solid #215E61; border-radius: 3px; margin-bottom: 6px;">${title3}</div>
            <table style="width: 100%; border-collapse: collapse; font-size: 8pt;">
              <thead>
                <tr style="background: #215E61; color: #fff;">
                  <th style="padding: 5px; border: 1px solid #d2ddd5;">No</th>
                  <th style="padding: 5px; border: 1px solid #d2ddd5;">Tanggal</th>
                  <th style="padding: 5px; border: 1px solid #d2ddd5;">Periode</th>
                  <th style="padding: 5px; border: 1px solid #d2ddd5;">Kategori</th>
                  <th style="padding: 5px; border: 1px solid #d2ddd5;">Keterangan</th>
                  <th style="padding: 5px; border: 1px solid #d2ddd5; text-align: right;">Nominal</th>
                </tr>
              </thead>
              <tbody>
                ${expList.map((e, i) => {
                  const nominal = Number(e.nominal) || 0;
                  expTotal += nominal;
                  return `<tr style="background: ${i % 2 === 0 ? '#fff' : '#f7faf8'};">
                            <td style="padding: 4px; border: 1px solid #d2ddd5; text-align: center;">${i + 1}</td>
                            <td style="padding: 4px; border: 1px solid #d2ddd5; text-align: center;">${Utils.formatTanggal(e.tanggal)}</td>
                            <td style="padding: 4px; border: 1px solid #d2ddd5;">${periodMap[e.periode_id] || '-'}</td>
                            <td style="padding: 4px; border: 1px solid #d2ddd5; text-align: center;"><span style="background: #eaf2f2; color: #215E61; padding: 2px 6px; border-radius: 3px;">${e.kategori}</span></td>
                            <td style="padding: 4px; border: 1px solid #d2ddd5;">${e.keterangan || '-'}</td>
                            <td style="padding: 4px; border: 1px solid #d2ddd5; text-align: right; font-weight: bold;">${Utils.formatRupiah(nominal)}</td>
                          </tr>`;
                }).join('')}
              </tbody>
              <tfoot>
                <tr style="background: #215E61; color: #fff; font-weight: bold;">
                  <td colspan="5" style="padding: 5px; text-align: center; border: 1px solid #215E61;">TOTAL PENGELUARAN</td>
                  <td style="padding: 5px; text-align: right; border: 1px solid #215E61;">${Utils.formatRupiah(expTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>`;
      }

      return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Rekap Kas Kelas ${cls}</title>
  <style>
    @page { size: A4; margin: 12mm 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 8.5pt; color: #1b281e; background: #fff; }
    .section.pgbreak { page-break-before: always; }
  </style>
</head>
<body>
  ${docHeader}
  ${body}
</body>
</html>`;
    },

    renderPengaturan() {
      // 1. Form values
      const classNameInput = document.getElementById('setting-class-name');
      const academicYearInput = document.getElementById('setting-academic-year');
      const defaultNominalInput = document.getElementById('setting-default-nominal');
      const initialBalanceInput = document.getElementById('setting-initial-balance');

      if (classNameInput) classNameInput.value = this.state.settings.className;
      if (academicYearInput) academicYearInput.value = this.state.settings.academicYear;
      if (defaultNominalInput) defaultNominalInput.value = (this.state.settings.defaultNominal || 0).toLocaleString('id-ID');
      if (initialBalanceInput) initialBalanceInput.value = (this.state.settings.initialBalance || 0).toLocaleString('id-ID');

      const headerInstInput = document.getElementById('setting-header-institution');
      const headerSubInput = document.getElementById('setting-header-sub');
      const headerAddrInput = document.getElementById('setting-header-address');

      if (headerInstInput) headerInstInput.value = this.state.settings.headerInstitution || '';
      if (headerSubInput) headerSubInput.value = this.state.settings.headerSub || '';
      if (headerAddrInput) headerAddrInput.value = this.state.settings.headerAddress || '';

      // 2. Categories Table
      const tbody = document.getElementById('tbody-kategori');
      if (!tbody) return;

      let html = '';
      this.state.kategoriList.forEach((k, index) => {
        html += `
          <tr>
            <td class="text-center font-bold">${index + 1}</td>
            <td><strong>${k.nama}</strong></td>
            <td class="text-center">
              <div class="table-actions-cell">
                <button class="btn-icon-action btn-action-danger btn-delete-kategori" data-id="${k.id}" data-nama="${k.nama}" title="Hapus Kategori" aria-label="Hapus"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
              </div>
            </td>
          </tr>
        `;
      });

      tbody.innerHTML = html;

      tbody.querySelectorAll('.btn-delete-kategori').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = parseInt(btn.getAttribute('data-id'), 10);
          const name = btn.getAttribute('data-nama');

          const isUsed = this.state.pengeluaranList.some(e => e.kategori === name);
          if (isUsed) {
            window.customAlert('Tidak Dapat Dihapus', `Kategori "${name}" sedang digunakan oleh data pengeluaran.`, 'warning');
            return;
          }

          window.customConfirm('Hapus Kategori', `Hapus kategori "${name}"?`, 'danger').then(async (confirmed) => { if (confirmed) {
            await this.db.delete('kategori', id);
            this.state.kategoriList = await this.db.getAll('kategori');
            Utils.showToast('Kategori berhasil dihapus.', 'success');
            this.renderPengaturan();
          }});
        });
      });
    },

    // ==========================================
    // 13. BACKUP & RESTORE (JSON)
    // ==========================================
    async exportBackupJson() {
      try {
        const backupData = {
          version: 1,
          exported_at: new Date().toISOString(),
          settings: this.state.settings,
          siswa: this.state.siswaList,
          periode: this.state.periodeList,
          pemasukan: this.state.pemasukanList,
          pengeluaran: this.state.pengeluaranList,
          kategori: this.state.kategoriList
        };

        const jsonStr = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const dateStr = Utils.getTodayISO();
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_rekap_kas_${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        Utils.showToast('Backup JSON berhasil dibuat.', 'success');
      } catch (err) {
        console.error('Backup failed:', err);
        Utils.showToast('Gagal membuat backup: ' + err.message, 'danger');
      }
    },

    async exportBackupExcel() {
      try {
        // Lazy-load XLSX if needed
        await ensureXLSX();
        if (!window.XLSX) {
          throw new Error('Library XLSX tidak ditemukan.');
        }
        const wb = XLSX.utils.book_new();

        // 1. Ringkasan
        const summaryData = [
          ['Informasi Data', 'Nilai'],
          ['Nama Kelas', this.state.settings.className],
          ['Tahun Ajaran', this.state.settings.academicYear],
          ['Nominal Kas Wajib', this.state.settings.defaultNominal || 0],
          ['Saldo Awal Kas', this.state.settings.initialBalance || 0],
          ['Total Siswa', this.state.siswaList.length],
          ['Total Periode', this.state.periodeList.length],
          ['Total Transaksi Pemasukan', this.state.pemasukanList.length],
          ['Total Transaksi Pengeluaran', this.state.pengeluaranList.length],
          ['Tanggal Export', new Date().toLocaleString('id-ID')]
        ];
        const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan');

        // 2. Daftar Siswa
        const siswaData = [
          ['No', 'ID', 'NISN', 'Nama Siswa', 'Jenis Kelamin', 'Status'],
          ...this.state.siswaList.map((s, i) => [i + 1, s.id, s.nisn || '', s.nama, s.jenis_kelamin || 'L', s.status || 'Aktif'])
        ];
        const wsSiswa = XLSX.utils.aoa_to_sheet(siswaData);
        XLSX.utils.book_append_sheet(wb, wsSiswa, 'Siswa');

        // 3. Daftar Periode
        const periodeData = [
          ['No', 'ID', 'Bulan', 'Tahun', 'Nominal Wajib'],
          ...this.state.periodeList.map((p, i) => [i + 1, p.id, p.bulan, p.tahun, p.nominal_wajib || 0])
        ];
        const wsPeriode = XLSX.utils.aoa_to_sheet(periodeData);
        XLSX.utils.book_append_sheet(wb, wsPeriode, 'Periode');

        // 4. Matriks Pemasukan
        const paymentMap = this.getValidPaymentMap();

        const headerRow = ['No', 'Nama Siswa', ...this.state.periodeList.map(p => `${p.bulan} ${p.tahun}`), 'Total Bayar'];
        const matrixRows = this.state.siswaList.map((s, i) => {
          let total = 0;
          const cols = this.state.periodeList.map(p => {
            const pay = paymentMap[`${s.id}_${p.id}`];
            const val = pay ? (Number(pay.nominal) || 0) : 0;
            total += val;
            return val;
          });
          return [i + 1, s.nama, ...cols, total];
        });
        const wsPemasukan = XLSX.utils.aoa_to_sheet([headerRow, ...matrixRows]);
        XLSX.utils.book_append_sheet(wb, wsPemasukan, 'Matriks Pemasukan');

        // 5. Riwayat Pengeluaran
        const periodMap = {};
        this.state.periodeList.forEach(p => { periodMap[p.id] = `${p.bulan} ${p.tahun}`; });

        const pengeluaranData = [
          ['No', 'ID', 'Tanggal', 'Periode', 'Kategori', 'Keterangan', 'Nominal (Rp)'],
          ...this.state.pengeluaranList.map((e, i) => [
            i + 1,
            e.id,
            e.tanggal,
            periodMap[e.periode_id] || '-',
            e.kategori || 'Umum',
            e.keterangan || '',
            Number(e.nominal) || 0
          ])
        ];
        const wsPengeluaran = XLSX.utils.aoa_to_sheet(pengeluaranData);
        XLSX.utils.book_append_sheet(wb, wsPengeluaran, 'Pengeluaran');

        const dateStr = Utils.getTodayISO();
        const classNameClean = (this.state.settings.className || 'Kelas').replace(/\s+/g, '_');
        XLSX.writeFile(wb, `backup_rekap_kas_${classNameClean}_${dateStr}.xlsx`);
        Utils.showToast('Backup Excel (.xlsx) berhasil dibuat.', 'success');
      } catch (err) {
        console.error('Export Excel Error:', err);
        Utils.showToast('Gagal export Excel: ' + err.message, 'danger');
      }
    },

    async exportBackupCsv() {
      try {
        const paymentMap = this.getValidPaymentMap();

        let csv = '\uFEFF';
        csv += `REKAP KAS KELAS ${this.state.settings.className}\n`;
        csv += `Tahun Ajaran: ${this.state.settings.academicYear}\n`;
        csv += `Tanggal Export: ${new Date().toLocaleString('id-ID')}\n\n`;

        csv += '--- REKAP PEMASUKAN SISWA ---\n';
        const periodHeaders = this.state.periodeList.map(p => `"${p.bulan} ${p.tahun}"`).join(',');
        csv += `No,Nama Siswa,${periodHeaders},Total (Rp)\n`;

        this.state.siswaList.forEach((s, i) => {
          let total = 0;
          const cols = this.state.periodeList.map(p => {
            const pay = paymentMap[`${s.id}_${p.id}`];
            const val = pay ? (Number(pay.nominal) || 0) : 0;
            total += val;
            return val;
          });
          csv += `${i + 1},"${s.nama.replace(/"/g, '""')}",${cols.join(',')},${total}\n`;
        });

        csv += '\n--- RIWAYAT PENGELUARAN KAS ---\n';
        csv += 'No,Tanggal,Kategori,Keterangan,Nominal (Rp)\n';
        this.state.pengeluaranList.forEach((e, i) => {
          csv += `${i + 1},"${e.tanggal}","${(e.kategori || '').replace(/"/g, '""')}","${(e.keterangan || '').replace(/"/g, '""')}",${Number(e.nominal) || 0}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const dateStr = Utils.getTodayISO();
        const classNameClean = (this.state.settings.className || 'Kelas').replace(/\s+/g, '_');
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_rekap_kas_${classNameClean}_${dateStr}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        Utils.showToast('Backup CSV (.csv) berhasil dibuat.', 'success');
      } catch (err) {
        console.error('Export CSV Error:', err);
        Utils.showToast('Gagal export CSV: ' + err.message, 'danger');
      }
    },

    handleRestoreFileSelect(event) {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (!data || (!data.siswa && !data.pemasukan && !data.periode)) {
            throw new Error('Format file backup tidak valid.');
          }

          this.state.pendingRestoreData = data;

          // Render stats in restore preview modal
          const statsBox = document.getElementById('restore-stats-content');
          if (statsBox) {
            statsBox.innerHTML = `
              <div style="line-height: 1.8;">
                <div><strong>Siswa:</strong> ${data.siswa?.length || 0} data</div>
                <div><strong>Periode:</strong> ${data.periode?.length || 0} periode</div>
                <div><strong>Pemasukan:</strong> ${data.pemasukan?.length || 0} transaksi</div>
                <div><strong>Pengeluaran:</strong> ${data.pengeluaran?.length || 0} transaksi</div>
                <div><strong>Kategori:</strong> ${data.kategori?.length || 0} kategori</div>
                <div><strong>Kelas:</strong> ${data.settings?.className || '-'} (${data.settings?.academicYear || '-'})</div>
              </div>
            `;
          }

          this.openModal('modal-restore-preview');
        } catch (err) {
          window.customAlert('Error Backup', 'Gagal membaca file backup: ' + err.message, 'danger');
        }
      };
      reader.readAsText(file);
      event.target.value = '';
    },

    async executeRestoreJson() {
      const data = this.state.pendingRestoreData;
      if (!data) return;

      try {
        // Clear all stores
        await this.db.clear('settings');
        await this.db.clear('siswa');
        await this.db.clear('periode');
        await this.db.clear('pemasukan');
        await this.db.clear('pengeluaran');
        await this.db.clear('kategori');

        // Restore Settings
        if (data.settings) {
          await this.db.setSetting('class_name', data.settings.className || '9A AB 2');
          await this.db.setSetting('academic_year', data.settings.academicYear || '2026/2027');
          await this.db.setSetting('default_nominal', data.settings.defaultNominal || 100000);
          await this.db.setSetting('initial_balance', data.settings.initialBalance || 0);
          await this.db.setSetting('is_setup_completed', true);
        }

        // Restore Siswa
        if (Array.isArray(data.siswa)) {
          for (const s of data.siswa) {
            await this.db.add('siswa', s);
          }
        }

        // Restore Periode
        if (Array.isArray(data.periode)) {
          for (const p of data.periode) {
            await this.db.add('periode', p);
          }
        }

        // Restore Pemasukan
        if (Array.isArray(data.pemasukan)) {
          for (const pay of data.pemasukan) {
            await this.db.add('pemasukan', pay);
          }
        }

        // Restore Pengeluaran
        if (Array.isArray(data.pengeluaran)) {
          for (const exp of data.pengeluaran) {
            await this.db.add('pengeluaran', exp);
          }
        }

        // Restore Kategori
        if (Array.isArray(data.kategori)) {
          for (const kat of data.kategori) {
            await this.db.add('kategori', kat);
          }
        }

        // Reload memory
        await this.loadInitialData();
        this.closeModal('modal-restore-preview');
        Utils.showToast('Data berhasil dipulihkan.', 'success');
        this.renderCurrentView();
      } catch (err) {
        console.error('Failed executing restore:', err);
        Utils.showToast('Gagal memulihkan data: ' + err.message, 'danger');
      }
    },

    // ==========================================
    // 14. EXCEL IMPORT PARSER & MAPPING
    // ==========================================
    handleExcelFileSelect(event) {
      const file = event.target.files[0];
      if (!file) return;

      // Lazy-load XLSX then parse
      ensureXLSX().then(() => {
        if (!window.XLSX) {
          window.customAlert('Informasi', 'Library Excel belum termuat.', 'info');
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });

            const extracted = this.parseExcelWorkbook(workbook);
            this.state.pendingExcelData = extracted;

            // Render stats & preview
            const statsBox = document.getElementById('excel-stats-content');
            const tablesBox = document.getElementById('excel-tables-preview');

            if (statsBox) {
              statsBox.innerHTML = `
                <div style="line-height: 1.8;">
                  <div><strong>Siswa Terdeteksi:</strong> ${extracted.siswa.length} orang</div>
                  <div><strong>Periode / Bulan Terdeteksi:</strong> ${extracted.periode.length} bulan</div>
                  <div><strong>Pemasukan Terdeteksi:</strong> ${extracted.pemasukan.length} transaksi</div>
                  <div><strong>Pengeluaran Terdeteksi:</strong> ${extracted.pengeluaran.length} transaksi</div>
                </div>
              `;
            }

            if (tablesBox) {
              tablesBox.innerHTML = `
                <table class="table table-bordered table-sm" style="font-size:0.8rem;">
                  <thead>
                    <tr>
                      <th>Nama Siswa Sample</th>
                      <th>Periode Sample</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${extracted.siswa.slice(0, 5).map((s, i) => `
                      <tr>
                        <td>${s.nama}</td>
                        <td>${extracted.periode[i]?.nama_periode || '-'}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              `;
            }

            this.openModal('modal-excel-preview');
          } catch (err) {
            console.error('Error parsing excel:', err);
            window.customAlert('Error Import', 'Gagal membaca file Excel: ' + err.message, 'danger');
          }
        };
        reader.readAsArrayBuffer(file);
      });

      event.target.value = '';
    },

    // Intelligent Excel Sheet Parser tailored for KAS 9A AB2 Juni.xlsx format
    parseExcelWorkbook(workbook) {
      const studentsFound = [];
      const periodsFound = [];
      const paymentsFound = [];
      const expensesFound = [];
      const currentYear = new Date().getFullYear();

      // Check sheets
      workbook.SheetNames.forEach((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        const jsonRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        if (!jsonRows || jsonRows.length === 0) return;

        // Try to identify matrix structure: find header row with student names or month names
        let headerRowIdx = -1;
        let nameColIdx = -1;
        let monthCols = [];

        for (let r = 0; r < Math.min(15, jsonRows.length); r++) {
          const row = jsonRows[r];
          for (let c = 0; c < row.length; c++) {
            const cellVal = String(row[c]).toLowerCase().trim();
            if (cellVal.includes('nama') || cellVal === 'siswa' || cellVal === 'nama siswa') {
              nameColIdx = c;
              headerRowIdx = r;
            }
          }
          if (nameColIdx !== -1) break;
        }

        if (nameColIdx !== -1 && headerRowIdx !== -1) {
          // Identify month columns in headerRow
          const hRow = jsonRows[headerRowIdx];
          for (let c = 0; c < hRow.length; c++) {
            if (c === nameColIdx) continue;
            const hVal = String(hRow[c]).trim();
            const matchedMonth = MONTHS_ID.find(m => hVal.toLowerCase().includes(m.toLowerCase()));
            if (matchedMonth) {
              monthCols.push({ colIdx: c, monthName: matchedMonth, headerText: hVal });
            }
          }

          // Register detected periods
          monthCols.forEach((mc, idx) => {
            if (!periodsFound.some(p => p.bulan === mc.monthName)) {
              periodsFound.push({
                id: periodsFound.length + 1,
                bulan: mc.monthName,
                tahun: currentYear,
                nama_periode: `${mc.monthName} ${currentYear}`,
                urutan: periodsFound.length + 1,
                aktif: true
              });
            }
          });

          // Extract students & payments
          for (let r = headerRowIdx + 1; r < jsonRows.length; r++) {
            const row = jsonRows[r];
            const nameVal = String(row[nameColIdx] || '').trim();
            if (!nameVal || nameVal.toLowerCase() === 'total' || nameVal.toLowerCase().includes('jumlah')) continue;

            // Register student
            let student = studentsFound.find(s => s.nama.toLowerCase() === nameVal.toLowerCase());
            if (!student) {
              student = {
                id: studentsFound.length + 1,
                nama: nameVal,
                status: 'Aktif',
                keterangan: 'Import Excel'
              };
              studentsFound.push(student);
            }

            // Extract payments per month col
            monthCols.forEach((mc) => {
              const cellVal = row[mc.colIdx];
              const nominal = Utils.parseRupiah(cellVal);
              const pObj = periodsFound.find(p => p.bulan === mc.monthName);

              if (nominal > 0 && pObj) {
                paymentsFound.push({
                  siswa_id: student.id,
                  periode_id: pObj.id,
                  tanggal: Utils.getTodayISO(),
                  nominal: nominal,
                  status: 'Lunas',
                  keterangan: 'Import Excel'
                });
              }
            });
          }
        }
      });

      return {
        siswa: studentsFound,
        periode: periodsFound,
        pemasukan: paymentsFound,
        pengeluaran: expensesFound
      };
    },

    async executeExcelImport() {
      const data = this.state.pendingExcelData;
      if (!data) return;

      try {
        // Add new students
        const studentIdMap = {};
        for (const s of data.siswa) {
          const existing = this.state.siswaList.find(x => x.nama.toLowerCase() === s.nama.toLowerCase());
          if (existing) {
            studentIdMap[s.id] = existing.id;
          } else {
            const newId = await this.db.add('siswa', {
              nama: s.nama,
              status: s.status || 'Aktif',
              keterangan: s.keterangan || 'Import Excel'
            });
            studentIdMap[s.id] = newId;
          }
        }

        // Add new periods
        const periodIdMap = {};
        for (const p of data.periode) {
          const existing = this.state.periodeList.find(x => x.bulan.toLowerCase() === p.bulan.toLowerCase() && x.tahun === p.tahun);
          if (existing) {
            periodIdMap[p.id] = existing.id;
          } else {
            const newId = await this.db.add('periode', {
              bulan: p.bulan,
              tahun: p.tahun,
              nama_periode: p.nama_periode,
              urutan: this.state.periodeList.length + 1,
              aktif: true
            });
            periodIdMap[p.id] = newId;
          }
        }

        // Add payments
        for (const pay of data.pemasukan) {
          const actualSiswaId = studentIdMap[pay.siswa_id];
          const actualPeriodeId = periodIdMap[pay.periode_id];

          if (actualSiswaId && actualPeriodeId) {
            const existing = this.state.pemasukanList.find(
              x => x.siswa_id === actualSiswaId && x.periode_id === actualPeriodeId
            );
            if (!existing) {
              await this.db.add('pemasukan', {
                siswa_id: actualSiswaId,
                periode_id: actualPeriodeId,
                tanggal: pay.tanggal || Utils.getTodayISO(),
                nominal: pay.nominal,
                status: pay.status || 'Lunas',
                keterangan: pay.keterangan || 'Import Excel',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              });
            }
          }
        }

        await this.loadInitialData();
        this.closeModal('modal-excel-preview');
        Utils.showToast('Data Excel berhasil diimport!', 'success');
        this.renderCurrentView();
      } catch (err) {
        console.error('Failed importing Excel:', err);
        Utils.showToast('Gagal import Excel: ' + err.message, 'danger');
      }
    }
  };

  // ==========================================
  // 15. BOOTSTRAP APPLICATION ON DOM LOADED
  // ==========================================
  // Expose App and changelog helper globally
  window.App = App;
  window.openChangelogModal = () => {
    if (App && typeof App.showChangelogModal === 'function') {
      App.showChangelogModal();
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    App.init();
  });
})();
