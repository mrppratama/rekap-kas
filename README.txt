========================================================================
                      APLIKASI REKAP KAS KELAS
     Aplikasi Web Ringan, Offline-First, Berbasis HTML, CSS & Vanilla JS
========================================================================

Aplikasi ini dibuat khusus untuk mempermudah pencatatan, perhitungan, dan
pencetakan rekap kas kelas secara lokal tanpa membutuhkan koneksi internet
atau server backend.

Data tersimpan secara aman di IndexedDB browser laptop Anda.

------------------------------------------------------------------------
1. CARA MENJALANKAN APLIKASI
------------------------------------------------------------------------
Cukup klik ganda (double-click) atau buka file:

   index.html

pada browser modern seperti Google Chrome, Microsoft Edge, atau Mozilla Firefox.

Tidak memerlukan instalasi Node.js, Web Server (XAMPP/Apache), atau internet.


------------------------------------------------------------------------
2. FITUR UTAMA
------------------------------------------------------------------------
✓ DASHBOARD
  - Kartu Saldo Saat Ini, Total Pemasukan, Total Pengeluaran, dan Siswa Aktif.
  - Tabel Rekap Global Saldo Bergulir otomatis per bulan.
  - Filter Tahun & Periode.

✓ REKAP PEMASUKAN (FORMAT MATRIKS EXCEL)
  - Tabel siswa x periode bulan dengan kolom sticky (No & Nama Siswa tetap
    terlihat saat scroll horizontal).
  - Klik langsung pada sel tabel untuk menambah, mengedit, atau menghapus
    pembayaran kas siswa.
  - Total per siswa dan total per bulan dihitung otomatis secara realtime.
  - Pencarian nama siswa & filter status pembayaran.

✓ REKAP PENGELUARAN
  - Pencatatan transaksi pengeluaran (Honor, Konsumsi, Kegiatan, dll).
  - Filter Tahun, Periode, dan Kategori.
  - Pencarian realtime keterangan/kategori.

✓ DATA SISWA
  - Penomoran otomatis.
  - Tambah, Edit, dan Ubah Status (Aktif / Nonaktif) jika siswa pindah
    sehingga riwayat transaksi kas tetap aman.

✓ PERIODE BULAN KAS
  - Kelola daftar periode kas. Kolom bulan pada tabel pemasukan dibuat
    secara otomatis dari daftar ini.

✓ CETAK LAPORAN & PDF LENGKAP
  - Cetak Rekap Global.
  - Cetak Rekap Pemasukan (A4 Landscape matriks).
  - Cetak Rekap Pengeluaran.
  - ⭐ CETAK SEMUA REKAPAN: Menggabungkan Bagian 1 (Global), Bagian 2 (Pemasukan),
    dan Bagian 3 (Pengeluaran) menjadi SATU file PDF lengkap dan rapi.

✓ BACKUP & RESTORE DATA (JSON)
  - Ekspor seluruh data kelas menjadi file JSON.
  - Pulihkan (Restore) data di laptop lain dengan pratinjau statistik data.

✓ IMPORT FILE EXCEL (.XLSX)
  - Impor data dari file spreadsheet (contoh: KAS 9A AB2 Juni.xlsx).
  - Pemetaan dan validasi otomatis sebelum masuk ke database.


------------------------------------------------------------------------
3. STRUKTUR FILE
------------------------------------------------------------------------
Rekap_Kas_Kelas/
├── index.html                       # Antarmuka web utama
├── style.css                        # Desain tampilan & stylesheet cetak
├── app.js                           # Logika aplikasi, IndexedDB, & PDF generator
├── README.txt                       # Panduan penggunaan
└── vendor/                          # Pustaka mandiri (100% offline)
    ├── jspdf.umd.min.js             # Generator PDF lokal
    ├── jspdf.plugin.autotable.min.js# Plugin tabel PDF
    └── xlsx.mini.min.js             # Parser file Excel lokal


------------------------------------------------------------------------
4. TIPS PENGGUNAAN & KEAMANAN DATA
------------------------------------------------------------------------
1. Lakukan "Backup Data (JSON)" secara berkala melalui menu Pengaturan
   untuk menyimpan salinan cadangan data kas Anda.
2. File backup JSON dapat dipindahkan ke laptop atau perangkat lain kapan saja.
3. Jangan menghapus siswa yang memiliki riwayat kas; cukup ubah statusnya
   menjadi "Nonaktif" agar data kas tetap seimbang.
========================================================================
