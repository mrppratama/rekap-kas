/**
 * FIREBASE FIRESTORE DB WRAPPER
 * Drop-in replacement for IndexedDB KasDatabase class.
 * Sama persis API: getAll, get, put, add, delete, clear, getSetting, setSetting
 *
 * CARA PAKAI:
 * 1. Buat project Firebase di https://console.firebase.google.com
 * 2. Aktifkan Firestore Database (mode "test" untuk awal, nanti atur rules)
 * 3. Aktifkan Authentication → Email/Password
 * 4. Salin config Firebase ke FIREBASE_CONFIG di bawah
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

class FirebaseDB {
  constructor() {
    this.db       = null;
    this.auth     = null;
    this.userId   = null;   // Data dipartisi per user (opsional multi-user)
    this._idCache = {};     // Map<storeName, Map<firestoreDocId, numericId>>
    this._counters = {};    // Auto-increment counter per store
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
   * Kembalikan path koleksi berdasarkan userId (agar data terpisah antar kelas/user)
   */
  _col(storeName) {
    const colName = STORE_TO_COLLECTION[storeName] || storeName;
    // Simpan data per user: users/{userId}/{collection}
    if (this.userId) {
      return this._fb.collection(this.db, 'users', this.userId, colName);
    }
    // Fallback jika belum login (seharusnya tidak terjadi)
    return this._fb.collection(this.db, colName);
  }

  /**
   * Helper: konversi Firestore document → object dengan field `id` numerik
   * Kita gunakan field _numId yang disimpan di dalam dokumen sebagai numeric id
   */
  _docToObj(docSnap) {
    if (!docSnap.exists()) return undefined;
    const data = docSnap.data();
    return { ...data, id: data._numId ?? data.id };
  }

  // ── getAll ──────────────────────────────────────────────────
  async getAll(storeName) {
    const snap = await this._fb.getDocs(this._col(storeName));
    return snap.docs.map(d => this._docToObj(d)).filter(Boolean);
  }

  // ── get (by numeric id) ──────────────────────────────────────
  async get(storeName, numericId) {
    // Cari dokumen yang punya field _numId === numericId
    const q = this._fb.query(this._col(storeName),
      this._fb.where('_numId', '==', numericId));
    const snap = await this._fb.getDocs(q);
    if (snap.empty) return undefined;
    return this._docToObj(snap.docs[0]);
  }

  // ── add (insert baru, return numeric id) ─────────────────────
  async add(storeName, item) {
    // Generate numeric ID via counter
    const numId = await this._getNextId(storeName);
    const payload = { ...item, _numId: numId, id: numId };
    // Gunakan numId sebagai Firestore doc ID (string)
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

  // ── clear (hapus semua dokumen dalam koleksi) ─────────────────
  async clear(storeName) {
    const snap = await this._fb.getDocs(this._col(storeName));
    const batch = this._fb.writeBatch(this.db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    // Reset counter
    this._counters[storeName] = 0;
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

  // ── Internal: auto-increment counter ────────────────────────
  async _getNextId(storeName) {
    // Cache counter in memory (reset on reload from Firestore)
    if (!this._counters[storeName]) {
      const snap = await this._fb.getDocs(this._col(storeName));
      let maxId = 0;
      snap.docs.forEach(d => {
        const numId = d.data()._numId;
        if (typeof numId === 'number' && numId > maxId) maxId = numId;
      });
      this._counters[storeName] = maxId;
    }
    this._counters[storeName]++;
    return this._counters[storeName];
  }
}
