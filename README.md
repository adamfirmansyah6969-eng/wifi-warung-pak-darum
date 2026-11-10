# KASIR WIFI — WARUNG PAK DARUM

Aplikasi kasir voucher WiFi: web app statis (HTML + CSS + JavaScript, tanpa PHP/MySQL, tanpa library eksternal).
Data tersimpan di **IndexedDB** di perangkat kasir — tetap ada setelah refresh. Bisa di-hosting di **GitHub Pages** atau shared hosting apa pun.

> **Pricelist resmi (bisa diubah di Pengaturan):** Paket Mabar (6 Jam) Rp2.000 · Paket Seharian (24 Jam) Rp3.000 · Paket Mingguan (7 Hari) Rp15.000 · Paket Sultan (30 Hari) Rp50.000.

## Isi paket

| File | Fungsi |
|---|---|
| `index.html` | Tampilan + struktur aplikasi |
| `app.js` | Semua logika (transaksi, stok, laporan, PDF struk, PIN, backup) |
| `manifest.json` | PWA (install ke Home Screen iPhone) |
| `sw.js` | Service Worker — cache agar bisa dibuka offline setelah kunjungan pertama |
| `icon-192.png`, `icon-512.png` | Ikon aplikasi |
| `contoh-voucher.csv` | Contoh format CSV import |
| `README.md` | Panduan ini |

**Tidak ada dependensi eksternal.** Tidak ada CDN, tidak ada payment gateway, tidak ada koneksi ke MikroTik di versi ini.

## Fitur

- **Dashboard** — penjualan hari ini, voucher terjual, total transaksi, stok tersedia, tunai & QRIS hari ini, grafik 7 hari, paket paling laris, transaksi terbaru, peringatan stok menipis (≤ 5). Semua angka dihitung dari data transaksi/stok sungguhan.
- **Kasir** — 4 paket (6 JAM / 1 HARI / 7 HARI / 30 HARI). Stok baru berkurang **setelah** pembayaran dikonfirmasi. Satu kode voucher tidak pernah terjual dua kali (alokasi + simpan transaksi dalam satu transaksi IndexedDB).
- **Tunai** — input uang diterima, kembalian otomatis, validasi uang tidak boleh kurang.
- **QRIS (manual)** — upload gambar QRIS statis di Pengaturan, tampil besar di kasir, kasir **wajib centang** bahwa sudah memeriksa pembayaran di aplikasi rekening/merchant. **Tidak ada verifikasi otomatis dan tidak ada payment gateway.**
- **Stok** — import CSV format MikroTik: `Username,Password,Profile,Time Limit,Data Limit,Comment`. Kolom `Username` dibaca sebagai kode voucher, kolom `Password` **diabaikan sepenuhnya** (tidak disimpan, tidak ditampilkan, tidak dicetak). Paket **terdeteksi otomatis dari Profile + Time Limit** (mis. `voucher-6-jam-2000` + `6h` → Paket Mabar) dan ditampilkan untuk dikonfirmasi admin — admin tetap bisa mengganti paket sebelum import. Duplikat terdeteksi dan dilewati, jumlah berhasil/duplikat ditampilkan. Format lama 2 kolom (`Username,Password`) tetap bisa dibaca.
- **Struk PDF 58 mm** — setelah transaksi berhasil, tombol **CETAK STRUK** membuka Share iOS (Web Share API) dengan file PDF ukuran 58 mm, siap dibagikan ke **Thermer**. Ada tombol Unduh PDF sebagai cadangan. Cetak ulang diberi label **SALINAN**. Struk kini dilengkapi **QR code** (lihat Batch 1).
- **Riwayat** — cari nomor transaksi/kode voucher, filter tanggal & metode, cetak ulang struk, ekspor CSV.
- **Pembatalan** — wajib alasan, waktu pembatalan tersimpan, transaksi **tidak dihapus**, kode voucher masuk **KARANTINA** (tidak otomatis kembali ke stok).
- **Laporan & Tutup Kas** — harian / 7 hari / bulanan, per paket, ekspor CSV. Tutup kas: saldo awal + tunai = saldo seharusnya, saldo aktual, selisih, catatan, riwayat. **QRIS tidak dihitung sebagai uang tunai.**
- **Keamanan & Pengaturan** — PIN kasir (default `1234`, segera ganti), kunci otomatis opsional 10 menit, konfirmasi sebelum batal/reset, backup JSON & restore, nama warung, harga paket, gambar QRIS, nomor WhatsApp opsional.
- **MikroTik** — integrasi **belum aktif** di versi ini. Stok berasal dari CSV yang diimpor. Kode disusun agar integrasi bisa ditambah nanti tanpa merusak fitur yang ada (sumber stok terpusat di store `vouchers`).

### Catatan keamanan (jujur)

PIN di aplikasi yang berjalan sepenuhnya di browser **bukan keamanan server**. PIN hanya mengunci layar di perangkat itu; orang yang bisa membuka file/database perangkat tetap bisa melihat data. Jangan anggap ini perlindungan data tingkat tinggi. Jangan simpan data sensitif lain di aplikasi ini.

### Catatan data

Aplikasi berjalan lokal di **satu perangkat**. Data **tidak** tersinkronisasi otomatis antarperangkat atau antar-browser. Pindahkan data antarperangkat lewat **Backup JSON → Restore JSON** di menu Pengaturan.

---

## 1. Cara menjalankan di laptop (tes cepat)

1. Ekstrak ZIP, buka folder `kasir-wifi-pak-darum`.
2. Jalankan server lokal sederhana (jangan buka `index.html` langsung dengan klik ganda — service worker & beberapa fitur butuh `http(s)`):
   - **Windows:** di folder itu, klik kanan → *Open in Terminal*, lalu `python -m http.server 8000` (atau `npx serve` bila ada Node).
   - **Mac/Linux:** `cd` ke folder itu, lalu `python3 -m http.server 8000`.
3. Buka `http://localhost:8000` di browser.
4. PIN default: `1234`.

## 2. Deploy ke GitHub Pages

1. Buat repository baru di GitHub (misal `kasir-wifi-pak-darum`), **Public**.
2. Upload semua file di folder ini ke repository (root repository, bukan subfolder).
3. Buka **Settings → Pages → Build and deployment → Source: Deploy from a branch**, pilih branch `main`, folder `/ (root)`, Save.
4. Tunggu 1–2 menit. Aplikasi bisa dibuka di `https://<username>.github.io/kasir-wifi-pak-darum/`.
5. Buka link itu sekali di iPhone (agar service worker ter-cache), setelah itu aplikasi tetap bisa dibuka walau sinyal lemah.

**Shared hosting:** upload semua file ke `public_html` (atau folder domain) lewat File Manager/cPanel — selesai, tidak ada konfigurasi server.

## 3. Panduan penggunaan di iPhone

### Install ke Home Screen (seperti aplikasi)
1. Buka link aplikasi di **Safari** (bukan Chrome — instalasi PWA iOS paling stabil dari Safari).
2. Ketuk tombol **Share** (kotak dengan panah ke atas) → **Add to Home Screen / Tambah ke Layar Utama** → **Add**.
3. Buka dari ikon di Home Screen. Aplikasi tampil layar penuh.

### Alur jualan (kasir)
1. Buka aplikasi, masukkan PIN.
2. Menu **Kasir** → ketuk paket (misal 1 HARI). Stok tersedia terlihat di kartu paket.
3. Isi nama pelanggan bila perlu (opsional).
4. Pilih **TUNAI** atau **QRIS**.
   - **TUNAI:** ketik uang diterima → kembalian terhitung otomatis. Uang kurang tidak bisa lanjut.
   - **QRIS:** tunjukkan gambar QRIS ke pelanggan, tunggu pelanggan bayar, **periksa di aplikasi rekening/merchant**, lalu centang pernyataan pemeriksaan.
5. Ketuk **Lanjut ke Ringkasan** → periksa lagi → **Konfirmasi Pembayaran**.
6. Struk muncul. Ketuk **CETAK STRUK** (lihat panduan Thermer di bawah) atau **Selesai**.
7. Stok berkurang 1 dan transaksi tersimpan — baru pada langkah konfirmasi, bukan sebelumnya.

### Import stok (admin)
1. Siapkan CSV dari MikroTik / spreadsheet dengan kolom `Username,Password` (lihat `contoh-voucher.csv`). Kolom Password boleh diisi apa saja — aplikasi mengabaikannya.
2. Menu **Stok** → **Choose File** → pilih CSV. Paket terdeteksi otomatis dari Profile (mis. file `voucher-6-jam-2000` → Paket Mabar) — periksa dan ganti bila salah → **Import CSV**.
3. Perhatikan hasil: jumlah berhasil & duplikat. Kode yang sudah ada (di paket mana pun) tidak diimpor ulang.

### Tutup kas (akhir hari)
1. Menu **Laporan** → isi **Saldo kas awal** (uang di laci pagi hari).
2. Tunai & QRIS hari ini terisi otomatis. Saldo seharusnya = saldo awal + tunai.
3. Hitung uang di laci, isi **Saldo kas aktual** → selisih terhitung otomatis.
4. Isi catatan bila ada selisih → **Simpan Tutup Kas**.

### Backup (lakukan rutin, misal tiap minggu)
Menu **Pengaturan → Backup JSON** → simpan file `backup-kasir-wifi-YYYY-MM-DD.json` di tempat aman (Google Drive / laptop). Untuk pindah perangkat: di perangkat baru buka aplikasi → Pengaturan → pilih file backup → **Restore**.

## 4. Menghubungkan Thermer dengan printer VSC MP-58C

Yang dibutuhkan: iPhone, printer **VSC MP-58C** (Bluetooth thermal 58 mm), aplikasi **Thermer** (App Store, iOS), kertas thermal 58 mm.

### A. Pairing printer ke iPhone (sekali saja)
1. Nyalakan printer MP-58C (lampu Bluetooth berkedip = siap pairing).
2. iPhone → **Settings → Bluetooth** → nyalakan Bluetooth.
3. Di daftar perangkat, ketuk nama printer (biasanya `MP-58C` / `VSC MP-58C` / `POS-58`).
4. Jika diminta PIN, coba `0000` atau `1234` (lihat buku manual printer).
5. Status harus **Connected / Terhubung**. Jika gagal: matikan-nyalakan printer, lupakan perangkat (*Forget This Device*) lalu pairing ulang. Jarak Bluetooth maksimal ~10 m, tanpa dinding tebal.

### B. Siapkan Thermer (sekali saja)
1. Install **Thermer** dari App Store, buka.
2. Tambah printer: pilih printer MP-58C yang sudah ter-pairing di Bluetooth.
3. Di pengaturan Thermer, atur **Paper width / Lebar kertas: 58 mm**.
4. Cetak **Test Page** dari Thermer. Jika test page keluar rapi, printer siap. Jika tidak keluar: cek kertas terpasang benar (sisi thermal menghadap ke atas), printer menyala, dan Bluetooth masih terhubung.

### C. Cetak struk dari aplikasi kasir (setiap transaksi)
1. Setelah transaksi berhasil, ketuk **CETAK STRUK (Thermer)**.
2. Menu **Share iOS** terbuka dengan file PDF struk (ukuran halaman 58 mm).
3. Cari dan ketuk **Thermer** di daftar aplikasi. (Jika Thermer tidak muncul: geser daftar aplikasi ke kanan → **More / Lainnya** → aktifkan Thermer, atau ketuk **Save to Files** dulu lalu buka PDF dari Files → Share → Thermer.)
4. Di Thermer, periksa pratinjau lalu ketuk **Print / Cetak**.
5. Struk keluar dari MP-58C.

### Jika tombol CETAK STRUK tidak membuka Share
- Browser tidak mendukung Web Share dengan file (misal Chrome iOS lama): ketuk **Unduh PDF 58mm**, buka PDF dari **Files**, ketuk Share → Thermer.
- Atau: dari layar struk, gunakan tombol Share bawaan Safari.
- **Yang tidak bisa dilakukan aplikasi ini:** mengirim perintah Bluetooth langsung ke printer, atau memanggil API Thermer — tidak ada dokumentasi integrasi publik untuk itu, jadi alur Share PDF di atas adalah cara yang benar dan didukung.

### Struk yang dicetak
Nama warung + nama WiFi, nomor transaksi, tanggal-jam, paket, harga, metode, **kode voucher besar dan tebal**, tanpa password. Cetak ulang selalu berlabel **SALINAN**.

## Batch 4 (v1.4.1) — Statistik

- **Statistik 30 hari** (menu Laporan, di bawah laporan periode): total transaksi & penjualan, rata-rata penjualan/hari, rata-rata nilai transaksi, total diskon promo yang diberikan, perbandingan metode (Tunai/QRIS/Gratis), paket terlaris, jam paling ramai, dan hari paling ramai.
- **Grafik jam ramai** (00–23, jam puncak berwarna emas) + bar hari Senin–Minggu + **5 member terbaik** berdasarkan total belanja. Transaksi yang dibatalkan tidak dihitung; voucher gratis dihitung sebagai transaksi tapi Rp0. Ada saran singkat di bawah grafik (mis. pertimbangkan stok & promo di jam sepi).

## Batch 3 (v1.4.0) — Promo & Member

- **Kode Promo** — dikelola di Pengaturan (tambah / aktifkan / matikan / hapus). Jenis: potongan Rp atau persen, berlaku untuk semua paket atau satu paket tertentu, bisa diberi tanggal kadaluarsa dan batas pemakaian. Contoh yang sudah aktif: **HEMAT500** (potongan Rp500, semua paket). Di Kasir ada kolom *Kode promo* — total bayar, kembalian, dan validasi tunai mengikuti harga setelah diskon; struk, pesan WA, laporan, dan tutup kas semuanya memakai total setelah diskon (bukan harga asli). Kode yang tidak berlaku (tidak aktif / kedaluwarsa / habis dipakai / salah paket) ditolak dengan alasan yang jelas. Pembatalan transaksi mengembalikan jatah pemakaian promo.
- **Member & Stempel** — menu baru **👥 Member**. Member tercatat otomatis saat pelanggan membeli dengan nama / nomor WA (dikenali dari nomor WA dulu, lalu nama). Setiap transaksi = 1 stempel. **5 stempel = 1 Paket Mabar (6 Jam) gratis**: tombol *Tukar 5 Stempel* di halaman Member (cek stok Mabar dulu), transaksi tercatat sebagai GRATIS Rp0 dan struknya tertulis "GRATIS — Tukar 5 Stempel Member". Ada juga tombol *Jual ke Member* yang mengisi Kasir dengan nama + nomor WA member itu. Pembatalan transaksi mengembalikan stempel (transaksi gratis yang dibatalkan mengembalikan 5 stempel). Member ikut tersimpan di backup JSON.

## Batch 2 (v1.3.0) — Kirim via WhatsApp + Cek Voucher

- **Kirim via WhatsApp** — di Kasir ada kolom *No. WA pelanggan (opsional)*. Setelah transaksi berhasil, tombol **Kirim via WhatsApp** di struk membuka WA dengan pesan yang sudah terisi: kode voucher, paket, harga, nomor transaksi, cara login, dan link cek masa aktif. Bila nomor WA diisi (format `0812…` otomatis diubah ke `62812…`), pesan langsung menuju nomor itu (`wa.me/62812…`); bila kosong, WhatsApp membuka pemilih kontak (`api.whatsapp.com/send`). Tombol WA yang sama ada di tiap baris Riwayat. Ini versi ringan — kasir tetap menekan tombol kirim di WhatsApp; kirim otomatis penuh butuh server (seperti bot Baileys) dan belum ada di versi ini.
- **Cek Voucher** — halaman publik **`cek.html`** (tanpa PIN, bisa dibuka pelanggan): masukkan kode → tampil status (Aktif / Belum terjual / Dibatalkan), paket, waktu beli, perkiraan habis, dan sisa waktu. Bisa juga dibuka dengan `cek.html?kode=ABC1234`. Ada juga kartu *Cek Voucher* di Dashboard untuk kasir yang membantu pelanggan mengecek. **Jujur:** sisa waktu adalah perkiraan dari waktu beli + durasi paket; tanpa integrasi MikroTik, aplikasi tidak tahu pemakaian sebenarnya di router — masa aktif yang berlaku tetap yang di router. Halaman cek membaca database yang sama (IndexedDB), jadi hanya jalan di perangkat/browser yang sama dengan aplikasi kasir.

## Batch 1 (v1.2.0) — QR, cetak massal, voucher otomatis

- **QR di struk** — setiap struk (layar + PDF) kini ada QR code di bawah kode voucher. Isi QR diatur di Pengaturan → *Alamat login hotspot*: bila diisi (mis. `http://192.168.88.1/login`, ganti IP dengan IP hotspot warung), QR membuka halaman login dengan username & password terisi. **Jujur:** isi otomatis dari URL hanya jalan bila halaman login hotspot warung mendukungnya — bila tidak, pelanggan tetap tinggal ketik kode yang tertera besar di struk, dan QR tetap berguna sebagai salinan kode yang bisa disalin dari HP. Bila alamat dikosongkan, QR hanya berisi kode voucher. Generator QR dibuat sendiri di dalam aplikasi (tanpa library/CDN) dan sudah dites bisa dibaca (decode) untuk kode pendek maupun URL login panjang.
- **Cetak massal** — menu Stok → *Cetak Massal Voucher*: pilih paket + jumlah (maks 50) → PDF multi-halaman, satu halaman 58mm per voucher (paket, harga, QR, kode besar, tulisan BAYAR DI KASIR). Voucher yang dicetak **belum terjual**. Saat pelanggan membayar, kasir isi kode dari struk itu di kolom *Kode voucher tertentu* di menu Kasir — transaksi memakai kode itu, bukan kode acak.
- **Jual kode tertentu** — kolom baru di Kasir. Bila dikosongkan, sistem tetap mengambil stok terlama seperti biasa. Bila kode sudah terjual / tidak ada / beda paket, transaksi ditolak dengan pesan yang jelas.
- **Buat voucher otomatis** — menu Stok → *Buat Voucher Otomatis*: pilih paket + jumlah (maks 100) + panjang kode (5–12, default 7) + awalan opsional. Kode dibuat acak tanpa huruf/angka yang mudah tertukar (tanpa 0, O, 1, I, L) dan dijamin tidak duplikat dengan stok yang ada. **PENTING: kode yang dibuat di sini belum ada di MikroTik** — pakai *Ekspor CSV untuk MikroTik* lalu import file itu ke MikroTik/User Manager, baru kode bisa dipakai pelanggan.
- **Ekspor CSV MikroTik** — menu Stok → pilih paket → ekspor stok tersedia dalam format `Username,Password,Profile,Time Limit,Data Limit,Comment` (Password = kode, sesuai model username=password warung). File ini hanya untuk admin — jangan dibagikan ke pelanggan.

## 5. Checklist tes sebelum dipakai jualan (sudah dites di sandbox)

**v1.4.1 (2026-11-09) — Batch 4:** statistik 30 hari (jam ramai, hari ramai, paket terlaris, member terbaik, rata-rata & diskon promo). Tes computeStats lolos; tes lama tetap lolos.

**v1.4.0 (2026-11-09) — Batch 3:** promo (Rp/%, per paket, kadaluarsa, batas pakai, contoh HEMAT500 aktif) + member & stempel (beli 5 gratis 1 Mabar, tukar stempel tercatat GRATIS Rp0, pembatalan mengembalikan stempel & jatah promo). Semua tes Batch 3 lolos; tes lama (CSV, Batch 1, Batch 2, pricelist) tetap lolos.

**v1.3.1 (2026-11-09) — Pricelist baru + cache PWA:** cache service worker dinaikkan ke `kasir-wifi-v1.3.1` — tanpa ini, PWA yang sudah terpasang di HP bisa terus memakai file lama dari cache offline dan harga lama tetap tampil walau file baru sudah diunggah. Aturan: naikkan nama cache di `sw.js` setiap rilis.

**v1.3.1 (2026-11-09) — Pricelist baru:** Mabar (6 Jam) Rp2.000, Seharian (24 Jam) Rp3.000, Mingguan (7 Hari) Rp15.000, Sultan (30 Hari) Rp50.000. Nama paket di kasir, struk, laporan, dan halaman cek ikut berubah. Perangkat yang sudah memakai versi lama otomatis ikut pricelist baru saat membuka v1.3.1 (migrasi sekali jalan); transaksi lama tidak berubah — harga/nama yang tercatat di riwayat tetap seperti saat terjual.

**v1.3.0 (2026-11-09) — Batch 2:** kirim WA (normalisasi 0812→62812 dites, link wa.me + pemilih kontak bila nomor kosong, pesan berisi kode/paket/cara login/link cek), cek voucher (cek.html publik tanpa PIN + kartu cek di Dashboard, status & perkiraan habis dari waktu beli + durasi paket, ditegaskan sebagai estimasi). Semua tes Batch 2 lolos.

**v1.2.0 (2026-11-09) — Batch 1:** QR di struk (generator sendiri, terverifikasi bisa di-decode dari hasil render PDF, untuk kode maupun URL login), cetak massal (PDF 3 halaman untuk 3 voucher, tiap halaman utuh tanpa tumpang tindih — sempat ada tumpang tindih label/kode di halaman massal, sudah diperbaiki dan dicek visual), jual kode tertentu, auto-generate voucher (charset tanpa 0/O/1/I/L, 100 kode tanpa duplikat), ekspor CSV MikroTik. Satu perbaikan selama pengerjaan: fungsi struk sempat terhapus oleh patch yang salah — sudah dibangun ulang lengkap dan semua tes (CSV, PDF, tutup kas, Batch 1) lolos lagi.

**v1.1.0 (2026-11-09) — format CSV asli:** import kini memakai format CSV MikroTik persis seperti file `voucher_6_jam.csv` (6 kolom, Profile `voucher-6-jam-2000`, Time Limit `6h`), dengan auto-detek paket dari Profile. Di file itu Username = Password (7 karakter, 99 kode, tanpa duplikat) — aplikasi tetap mengabaikan kolom Password; struk hanya mencetak kode sekali, dan kode itu sudah cukup untuk login hotspot karena username dan password-nya sama. File CSV asli user TIDAK disertakan di ZIP ini — contoh di ZIP memakai kode dummy.

**v1.0.1 (2026-11-09) — perbaikan struk PDF:** lebar teks kini diukur dengan lebar karakter Helvetica asli (bukan perkiraan), font mengecil otomatis bila teks terlalu panjang, dan jarak baris mengikuti ukuran font. Sebelumnya teks terpotong di tepi kanan dan kode voucher menimpa label di atasnya. Sudah dites ulang dengan render PDF: struk transaksi yang sama kini tampil utuh, kode `DEMO-6JAM-001` lengkap dan tidak tumpang tindih; kode panjang (28 karakter) mengecil otomatis dan tetap muat.

Yang sudah diverifikasi saat pembuatan (Node, tanpa iPhone/printer sungguhan):

- [x] Sintaks `app.js` lolos `node --check`; `index.html` valid, semua tombol punya handler.
- [x] Parser CSV: kolom Username dibaca, Password diabaikan, duplikat terdeteksi, file contoh terbaca.
- [x] Generator PDF 58 mm: lebar halaman 164 pt (58 mm), kode voucher font besar, tanpa password, label SALINAN pada cetak ulang.
- [x] Logika tutup kas: QRIS tidak masuk saldo tunai (cek unit test di bawah).
- [x] Data bertahan setelah refresh (IndexedDB) — perlu dites ulang di iPhone setelah install.

**Yang masih harus dites di iPhone + printer sungguhan (tidak bisa dites dari sandbox):**
1. Buka di Safari iPhone → PIN 1234 → muat stok contoh (menu Stok → *Muat stok contoh*) → jual 1 voucher TUNAI dan 1 voucher QRIS.
2. CETAK STRUK → Share → Thermer → printer MP-58C. Periksa kode voucher terbaca dan tidak terpotong.
3. Coba stok habis (jual sampai habis) — tombol harus menolak dengan pesan stok habis.
4. Batalkan satu transaksi → kode harus masuk Karantina, bukan kembali ke stok.
5. Tutup kas → periksa selisih.
6. Backup JSON → hapus satu data → Restore → data kembali.

## 6. Mengganti harga / nama / QRIS

- **Harga:** Pengaturan → Harga paket → Simpan. Berlaku untuk transaksi berikutnya, transaksi lama tidak berubah.
- **Nama warung/WiFi:** Pengaturan → Nama warung & WiFi → Simpan. Nama baru tampil di header dan struk.
- **QRIS:** Pengaturan → Gambar QRIS statis → pilih gambar QR dari merchant → tersimpan di perangkat. Hapus dengan tombol *Hapus gambar QRIS*.
- **PIN:** Pengaturan → PIN kasir → isi PIN lama (default `1234`) dan PIN baru 4–6 digit.

## 7. Batasan yang perlu diketahui

- Satu perangkat = satu database. Dua iPhone tidak berbagi data otomatis.
- QRIS manual: tidak ada pengecekan pembayaran otomatis. Kasir harus memeriksa sendiri.
- MikroTik belum terhubung: voucher yang dijual harus sudah dibuat di MikroTik (User Manager / hotspot) dan diimpor sebagai CSV. Aplikasi tidak membuat user MikroTik.
- PIN bukan keamanan server (lihat catatan keamanan di atas).
- Service Worker butuh HTTPS (GitHub Pages sudah HTTPS) atau `localhost` untuk bekerja.
