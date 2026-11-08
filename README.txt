WIFI VOUCHER PRINT — @WIFI WARUNG PAK DARUM

ISI:
- index.html : halaman aplikasi
- app.js : data kode voucher + logika aplikasi
- manifest.webmanifest dan sw.js : dukungan instalasi PWA/offline

DATA CSV:
Aplikasi membaca kolom Username sebagai KODE VOUCHER saja.
Password dan kolom lain tidak ditampilkan atau dicetak.
Data awal berasal dari empat file CSV yang diberikan:
- voucher 6 jam.csv (99 kode)
- voucher 1 hari.csv (100 kode)
- vocuher 7 hari.csv (100 kode)
- voucher 30 hari.csv (100 kode)
Total 399 kode.

CARA MENJALANKAN:
1. Ekstrak ZIP.
2. Upload folder ke hosting HTTPS (contoh: hosting/domain sendiri).
   Untuk uji lokal, buka index.html, tetapi fitur PWA memerlukan HTTPS atau localhost.
3. Buka URL aplikasi di Chrome iPhone.
4. Pilih jenis voucher.
5. Tekan Cetak voucher. Dialog cetak iOS akan terbuka.
6. Setelah benar-benar tercetak, kembali ke web dan tekan "Sudah tercetak".
7. Aplikasi akan memilih kode berikutnya yang belum dicetak.

PENTING TENTANG BLUETOOTH iPHONE:
Web app di Chrome iPhone tidak dapat mengirim data Bluetooth Classic/SPP langsung dari JavaScript.
Tombol cetak saat ini memakai dialog cetak sistem iOS (window.print) dengan layout 58mm.
Agar mencetak ke VSC MP-58C RPP02 melalui Bluetooth, diperlukan aplikasi iOS pendamping yang kompatibel dan mendukung menerima dokumen/pekerjaan cetak dari browser atau share sheet, atau SDK/protokol printer yang cocok.
Jangan anggap koneksi Bluetooth sudah terintegrasi sebelum diuji pada unit printer.
Jika aplikasi pendamping hanya menerima teks melalui fitur share, alur cetaknya perlu disesuaikan dengan aplikasi tersebut.

STATUS CETAK:
Status tersimpan di penyimpanan browser pada perangkat yang sama. Hapus data situs/browser dapat menghapus riwayat status.


AKSES HTTPS DENGAN TRYCloudflare:
1. Ekstrak ZIP ke folder di PC Windows.
2. Install Python 3 dan Cloudflare Tunnel (cloudflared).
   Dokumentasi unduhan cloudflared:
   https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
3. Pastikan perintah "python" dan "cloudflared" dapat dijalankan dari Command Prompt.
4. Jalankan START-TRYCloudflare.bat.
5. Tunggu alamat HTTPS acak berakhiran .trycloudflare.com muncul.
6. Buka alamat HTTPS tersebut dari Chrome di iPhone.
7. PC harus tetap menyala dan jendela tunnel harus tetap berjalan selama web app dipakai.

PENTING:
- Quick Tunnel TryCloudflare menghasilkan URL sementara/acak. URL dapat berubah setiap kali tunnel dimulai ulang.
- Quick Tunnel ditujukan untuk uji coba, bukan hosting permanen/produksi.
- Jangan bagikan URL tunnel ke publik jika daftar kode voucher masih dianggap rahasia.
- Untuk PWA, akses HTTPS dari URL TryCloudflare memungkinkan service worker dan fitur instalasi yang didukung iOS.
- TryCloudflare hanya menyediakan HTTPS/akses web. Ini tidak menambahkan dukungan Bluetooth printer ke Chrome iPhone.


INTEGRASI MOBILE PRINT UTIL (iPHONE):
- Tombol "Cetak via Mobile Print Util" menggunakan URL scheme:
  com.samathosoft.webprint://#deb64#<BASE64-UTF8-HTML>
- Format #deb64# untuk HTML UTF-8 didokumentasikan oleh pengembang Mobile Print Util.
- Pada iPhone, aplikasi Mobile Print Util harus sudah terpasang dan printer sudah tersambung.
- Setelah menekan cetak, iOS akan membuka Mobile Print Util. Pastikan struk benar-benar tercetak.
- Kembali ke web app dan tekan "Konfirmasi tercetak". Aplikasi tidak menandai otomatis karena browser tidak menerima bukti sukses cetak dari aplikasi pendamping.
- Jika link scheme tidak membuka aplikasi pada perangkat tertentu, gunakan tes link resmi Mobile Print Util dan cek apakah iOS masih mengizinkan pembukaan aplikasi dari Chrome.
