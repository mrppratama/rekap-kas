/**
 * FIREBASE FIRESTORE DB WRAPPER (MULTI-CLASS SUPPORT)
 * Drop-in replacement for IndexedDB KasDatabase class.
 * Mendukung multi-kelas per akun admin:
 * Path data: /users/{userId}/classes/{classId}/{collection}/{document}
 */

// ============================================================
// ⚠️  CONFIG RESMI FIREBASE PROJECT ⚠️
// ============================================================
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyCkC6C0HqWYk2ropoy4hpZOi8Dso8iwxD0",
  authDomain:        "rekapkas-12674.firebaseapp.com",
  projectId:         "rekapkas-12674",
  storageBucket:     "rekapkas-12674.firebasestorage.app",
  messagingSenderId: "277577254381",
  appId:             "1:277577254381:web:d639b3f0202b0dd88dd3e4",
  measurementId:     "G-S0B15PVF80"
};
// ============================================================

// Store name → Firestore collection name mapping
const STORE_TO_COLLECTION = {
  settings:    'settings',
  siswa:       'siswa',
  periode:     'periode',
  pemasukan:   'pemasukan',
  pengeluaran: 'pengeluaran',
  kategori:    'kategori'
};

const DEFAULT_CLASS_CATEGORIES = [
  'Konsumsi',
  'Honor',
  'Kegiatan',
  'Perlengkapan',
  'Transportasi',
  'Lainnya'
];

class FirebaseDB {
  constructor() {
    this.db             = null;
    this.auth           = null;
    this.userId         = null;
    this.currentClassId = null;  // ID kelas yang aktif
    this.classes        = [];    // Daftar kelas milik user: Array<{ id, nama, tahun_ajaran, ... }>
    this._idCache       = {};    // Map<storeName, Map<firestoreDocId, numericId>>
    this._counters      = {};    // Auto-increment counter per (classId + store)
  }

  /**
   * Inisialisasi Firebase & Firestore
   * Dipanggil sekali dari App.init()
   */
  async init() {
    // Dynamically import Firebase SDK (modular v10) dari CDN
    const { initializeApp }         = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
    const { initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
            collection, doc, getDocs, getDoc, setDoc, addDoc, deleteDoc, writeBatch,
            query, where, orderBy } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const { getAuth, onAuthStateChanged,
            signInWithEmailAndPassword, createUserWithEmailAndPassword,
            signOut }               = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');

    // Simpan references
    this._fb = { initializeApp, initializeFirestore,
                 collection, doc, getDocs, getDoc, setDoc, addDoc,
                 deleteDoc, writeBatch, query, where, orderBy,
                 getAuth, onAuthStateChanged, signInWithEmailAndPassword,
                 createUserWithEmailAndPassword, signOut };

    const app = initializeApp(FIREBASE_CONFIG);

    // Modern Firestore Cache initialization (prevents deprecation warning)
    try {
      this.db = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      });
      console.log('[FirebaseDB] Offline persistence enabled with persistentLocalCache.');
    } catch (err) {
      console.warn('[FirebaseDB] LocalCache init fallback:', err);
      this.db = initializeFirestore(app, {});
    }

    this.auth = getAuth(app);
    return this;
  }

  /**
   * Kembalikan path koleksi berdasarkan userId dan kelas aktif (currentClassId)
   */
  _col(storeName) {
    const colName = STORE_TO_COLLECTION[storeName] || storeName;
    if (this.userId) {
      if (storeName === 'classes') {
        return this._fb.collection(this.db, 'users', this.userId, 'classes');
      }
      if (this.currentClassId) {
        return this._fb.collection(this.db, 'users', this.userId, 'classes', this.currentClassId, colName);
      }
      return this._fb.collection(this.db, 'users', this.userId, colName);
    }
    return this._fb.collection(this.db, colName);
  }

  /**
   * Helper: konversi Firestore document → object dengan field `id` numerik / string
   */
  _docToObj(docSnap) {
    if (!docSnap.exists()) return undefined;
    const data = docSnap.data();
    return { ...data, id: data._numId ?? data.id };
  }

  // ============================================================
  // MULTI-CLASS MANAGEMENT
  // ============================================================

  /**
   * Inisialisasi daftar kelas untuk user yang sedang login.
   * Termasuk migrasi otomatis untuk akun lama yang datanya masih di root user.
   */
  async initClasses() {
    if (!this.userId) return [];

    const classesCol = this._fb.collection(this.db, 'users', this.userId, 'classes');
    const snap = await this._fb.getDocs(classesCol);

    if (!snap.empty) {
      this.classes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      this.classes.sort((a, b) => (a.urutan || 0) - (b.urutan || 0) || (a.createdAt || 0) - (b.createdAt || 0));
    } else {
      // Belum ada koleksi classes. Cek apakah ada data lama di root users/{userId}/
      const legacySettingsSnap = await this._fb.getDocs(this._fb.collection(this.db, 'users', this.userId, 'settings'));
      const legacySiswaSnap = await this._fb.getDocs(this._fb.collection(this.db, 'users', this.userId, 'siswa'));

      let defaultClassName = 'Kelas Utama';
      let defaultAcademicYear = '2026/2027';

      if (!legacySettingsSnap.empty) {
        legacySettingsSnap.docs.forEach(docSnap => {
          const d = docSnap.data();
          if (d.key === 'class_name' && d.value) defaultClassName = d.value;
          if (d.key === 'academic_year' && d.value) defaultAcademicYear = d.value;
        });
      }

      const hasLegacyData = !legacySettingsSnap.empty || !legacySiswaSnap.empty;
      const defaultClassId = 'class_' + Date.now();

      const defaultClassData = {
        id: defaultClassId,
        nama: defaultClassName,
        tahun_ajaran: defaultAcademicYear,
        urutan: 1,
        createdAt: Date.now(),
        is_default: true
      };

      await this._fb.setDoc(this._fb.doc(classesCol, defaultClassId), defaultClassData);
      this.classes = [defaultClassData];

      // Jika ada data legacy, salin ke subcollection class pertama tanpa menghapus aslinya
      if (hasLegacyData) {
        console.log('[FirebaseDB] Memigrasikan data akun lama ke kelas:', defaultClassId);
        const stores = ['settings', 'siswa', 'periode', 'pemasukan', 'pengeluaran', 'kategori'];
        for (const store of stores) {
          const colName = STORE_TO_COLLECTION[store] || store;
          const rootCol = this._fb.collection(this.db, 'users', this.userId, colName);
          const rootDocs = await this._fb.getDocs(rootCol);
          if (!rootDocs.empty) {
            const targetCol = this._fb.collection(this.db, 'users', this.userId, 'classes', defaultClassId, colName);
            let batch = this._fb.writeBatch(this.db);
            let count = 0;
            for (const docItem of rootDocs.docs) {
              batch.set(this._fb.doc(targetCol, docItem.id), docItem.data());
              count++;
              if (count >= 400) {
                await batch.commit();
                batch = this._fb.writeBatch(this.db);
                count = 0;
              }
            }
            if (count > 0) {
              await batch.commit();
            }
          }
        }
        console.log('[FirebaseDB] Migrasi data akun lama selesai.');
      }
    }

    // Tentukan kelas aktif
    const storedClassId = localStorage.getItem('rekapkas_active_class_' + this.userId);
    const matchedClass = this.classes.find(c => c.id === storedClassId);
    if (matchedClass) {
      this.currentClassId = matchedClass.id;
    } else if (this.classes.length > 0) {
      this.currentClassId = this.classes[0].id;
      localStorage.setItem('rekapkas_active_class_' + this.userId, this.currentClassId);
    }

    return this.classes;
  }

  getClasses() {
    return this.classes || [];
  }

  getCurrentClass() {
    if (!this.classes || !this.currentClassId) return null;
    return this.classes.find(c => c.id === this.currentClassId) || null;
  }

  /**
   * Beralih ke kelas lain berdasarkan classId
   */
  async switchClass(classId) {
    if (!this.userId) throw new Error('User belum login');
    const matchedClass = this.classes.find(c => c.id === classId);
    if (!matchedClass) {
      throw new Error('Kelas tidak ditemukan');
    }
    this.currentClassId = matchedClass.id;
    localStorage.setItem('rekapkas_active_class_' + this.userId, this.currentClassId);
    this._idCache = {};
    return matchedClass;
  }

  /**
   * Tambah kelas baru untuk user ini
   */
  async addClass({ nama, tahun_ajaran, default_nominal = 100000, initial_balance = 0, default_categories = true, default_periods = true }) {
    if (!this.userId) throw new Error('User belum login');
    const classId = 'class_' + Date.now();
    const classData = {
      id: classId,
      nama: nama.trim(),
      tahun_ajaran: tahun_ajaran.trim(),
      urutan: this.classes.length + 1,
      createdAt: Date.now()
    };

    const classesCol = this._fb.collection(this.db, 'users', this.userId, 'classes');
    await this._fb.setDoc(this._fb.doc(classesCol, classId), classData);
    this.classes.push(classData);

    // Inisialisasi settings awal untuk kelas baru
    const setClassSetting = async (k, v) => {
      const docRef = this._fb.doc(this.db, 'users', this.userId, 'classes', classId, 'settings', k);
      await this._fb.setDoc(docRef, { key: k, value: v, _numId: k, id: k });
    };

    await setClassSetting('class_name', classData.nama);
    await setClassSetting('academic_year', classData.tahun_ajaran);
    await setClassSetting('default_nominal', Number(default_nominal) || 100000);
    await setClassSetting('initial_balance', Number(initial_balance) || 0);
    await setClassSetting('is_setup_completed', true);

    // Kategori default
    if (default_categories) {
      const katCol = this._fb.collection(this.db, 'users', this.userId, 'classes', classId, 'kategori');
      let katId = 1;
      for (const cat of DEFAULT_CLASS_CATEGORIES) {
        await this._fb.setDoc(this._fb.doc(katCol, String(katId)), {
          id: katId,
          _numId: katId,
          nama: cat
        });
        katId++;
      }
    }

    // Periode bulan default (4 bulan)
    if (default_periods) {
      const perCol = this._fb.collection(this.db, 'users', this.userId, 'classes', classId, 'periode');
      const curYear = new Date().getFullYear();
      const defaultMonths = ['Agustus', 'September', 'Oktober', 'November'];
      let pOrder = 1;
      for (const m of defaultMonths) {
        await this._fb.setDoc(this._fb.doc(perCol, String(pOrder)), {
          id: pOrder,
          _numId: pOrder,
          bulan: m,
          tahun: curYear,
          nama_periode: `${m} ${curYear}`,
          urutan: pOrder,
          aktif: true
        });
        pOrder++;
      }
    }

    return classId;
  }

  /**
   * Update info kelas (nama / tahun ajaran)
   */
  async updateClass(classId, { nama, tahun_ajaran }) {
    if (!this.userId) return;
    const docRef = this._fb.doc(this.db, 'users', this.userId, 'classes', classId);
    const updates = {
      nama: nama.trim(),
      tahun_ajaran: tahun_ajaran.trim(),
      updatedAt: Date.now()
    };
    await this._fb.setDoc(docRef, updates, { merge: true });

    const item = this.classes.find(c => c.id === classId);
    if (item) {
      item.nama = updates.nama;
      item.tahun_ajaran = updates.tahun_ajaran;
    }

    // Jika ini adalah kelas yang sedang aktif, update juga setting-nya
    if (this.currentClassId === classId) {
      await this.setSetting('class_name', updates.nama);
      await this.setSetting('academic_year', updates.tahun_ajaran);
    }
  }

  /**
   * Hapus kelas beserta seluruh subcollection data kas di dalamnya
   */
  async deleteClass(classId) {
    if (!this.userId) return;
    if (this.classes.length <= 1) {
      throw new Error('Tidak dapat menghapus kelas terakhir. Minimal harus ada 1 kelas aktif.');
    }

    // Hapus seluruh dokumen di setiap subcollection kelas ini
    const stores = ['settings', 'siswa', 'periode', 'pemasukan', 'pengeluaran', 'kategori'];
    for (const store of stores) {
      const colName = STORE_TO_COLLECTION[store] || store;
      const subCol = this._fb.collection(this.db, 'users', this.userId, 'classes', classId, colName);
      const snap = await this._fb.getDocs(subCol);
      if (!snap.empty) {
        let batch = this._fb.writeBatch(this.db);
        let count = 0;
        for (const docItem of snap.docs) {
          batch.delete(docItem.ref);
          count++;
          if (count >= 400) {
            await batch.commit();
            batch = this._fb.writeBatch(this.db);
            count = 0;
          }
        }
        if (count > 0) {
          await batch.commit();
        }
      }
    }

    // Hapus dokumen kelas utama
    const classDocRef = this._fb.doc(this.db, 'users', this.userId, 'classes', classId);
    await this._fb.deleteDoc(classDocRef);

    // Update in-memory list
    this.classes = this.classes.filter(c => c.id !== classId);
    this._idCache = {};

    // Jika yang dihapus adalah kelas aktif, beralih ke kelas pertama yang tersedia
    if (this.currentClassId === classId) {
      this.currentClassId = this.classes[0].id;
      localStorage.setItem('rekapkas_active_class_' + this.userId, this.currentClassId);
    }

    return this.currentClassId;
  }

  // ── getAll ──────────────────────────────────────────────────
  async getAll(storeName) {
    const snap = await this._fb.getDocs(this._col(storeName));
    return snap.docs.map(d => this._docToObj(d)).filter(Boolean);
  }

  // ── get (by numeric id) ──────────────────────────────────────
  async get(storeName, numericId) {
    const q = this._fb.query(this._col(storeName),
      this._fb.where('_numId', '==', numericId));
    const snap = await this._fb.getDocs(q);
    if (snap.empty) return undefined;
    return this._docToObj(snap.docs[0]);
  }

  // ── add (insert baru, return numeric id) ─────────────────────
  async add(storeName, item) {
    const numId = await this._getNextId(storeName);
    const payload = { ...item, _numId: numId, id: numId };
    const docRef = this._fb.doc(this._col(storeName), String(numId));
    await this._fb.setDoc(docRef, payload);
    return numId;
  }

  // ── put (upsert by numeric id) ───────────────────────────────
  async put(storeName, item) {
    const numId = item._numId ?? item.id;
    if (!numId) throw new Error('put() requires item.id');
    const payload = { ...item, _numId: numId, id: numId };
    const docRef = this._fb.doc(this._col(storeName), String(numId));
    await this._fb.setDoc(docRef, payload, { merge: true });
    return numId;
  }

  // ── delete ───────────────────────────────────────────────────
  async delete(storeName, numericId) {
    const docRef = this._fb.doc(this._col(storeName), String(numericId));
    await this._fb.deleteDoc(docRef);
    return true;
  }

  // ── clear (hapus semua dokumen dalam koleksi kelas ini) ───────
  async clear(storeName) {
    const snap = await this._fb.getDocs(this._col(storeName));
    const batch = this._fb.writeBatch(this.db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    const counterKey = `${this.currentClassId || 'root'}_${storeName}`;
    this._counters[counterKey] = 0;
    return true;
  }

  // ── Settings helpers ─────────────────────────────────────────
  async getSetting(key, defaultValue = null) {
    const docRef = this._fb.doc(this._col('settings'), key);
    const snap   = await this._fb.getDoc(docRef);
    if (!snap.exists()) return defaultValue;
    return snap.data().value ?? defaultValue;
  }

  async setSetting(key, value) {
    const docRef = this._fb.doc(this._col('settings'), key);
    await this._fb.setDoc(docRef, { key, value, _numId: key, id: key });
    return key;
  }

  // ── Auth helpers ─────────────────────────────────────────────
  async login(email, password) {
    const cred = await this._fb.signInWithEmailAndPassword(this.auth, email, password);
    this.userId = cred.user.uid;
    return cred.user;
  }

  async register(email, password) {
    const cred = await this._fb.createUserWithEmailAndPassword(this.auth, email, password);
    this.userId = cred.user.uid;
    return cred.user;
  }

  async logout() {
    await this._fb.signOut(this.auth);
    this.userId = null;
    this.currentClassId = null;
    this.classes = [];
  }

  /**
   * Cek status login saat init.
   * Return: User object jika sudah login, null jika belum.
   */
  waitForAuth() {
    return new Promise((resolve) => {
      const unsub = this._fb.onAuthStateChanged(this.auth, (user) => {
        unsub();
        if (user) {
          this.userId = user.uid;
          resolve(user);
        } else {
          resolve(null);
        }
      });
    });
  }

  // ── Internal: auto-increment counter per class ──────────────
  async _getNextId(storeName) {
    const counterKey = `${this.currentClassId || 'root'}_${storeName}`;
    if (!this._counters[counterKey]) {
      const snap = await this._fb.getDocs(this._col(storeName));
      let maxId = 0;
      snap.docs.forEach(d => {
        const numId = d.data()._numId;
        if (typeof numId === 'number' && numId > maxId) maxId = numId;
      });
      this._counters[counterKey] = maxId;
    }
    this._counters[counterKey]++;
    return this._counters[counterKey];
  }
}
