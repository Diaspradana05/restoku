# Restoku

Aplikasi kasir dan manajemen restoran. Dibuat dengan React (Vite) dan Express.

## Fitur

- Order, diskon (persen atau nominal), pembayaran tunai, QRIS, atau kartu, dan cetak struk
- Denah meja dengan status kursi otomatis dan pindah meja
- Layar dapur dengan antrian dan waktu tunggu
- Shift kasir (kas awal, hitung kas, selisih)
- Laporan transaksi dan shift dengan filter periode, export CSV, dan PDF
- Kelola menu dan akun dengan role Admin, Kasir, dan Dapur
- Dashboard penjualan

## Hak akses

- Admin: semua halaman dan semua laporan (bisa filter per kasir)
- Kasir: Dashboard, Orders, Meja, Shift, dan laporan miliknya sendiri
- Dapur: layar dapur

## Menjalankan di lokal

Jalankan perintah berikut:

    npm run setup
    npm run dev

Buka http://localhost:5173. Login awal: admin@restoku.com dengan password admin123.
Di lokal data disimpan sebagai file JSON di folder server.

## Deploy ke Vercel

Data disimpan di Upstash Redis karena Vercel tidak bisa menyimpan file.

1. Import repo ke Vercel (Framework Preset: Other).
2. Hubungkan Upstash Redis lewat tab Storage.
3. Isi environment variable di Settings: SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, dan RESTO_ADDRESS.
4. Deploy. Jika env baru diisi setelahnya, lakukan Redeploy.

Opsional: DEMO_MODE=true untuk data contoh dan akun demo di halaman login, APP_TIMEZONE (default Asia/Jakarta), RESTO_NAME.

## Catatan

- Pembayaran dan tutup shift hanya bisa dilakukan oleh pembuka shift atau admin.
- Diskon dihitung sebelum service 5% dan pajak 10%.
- Penyimpanan Redis cocok untuk satu outlet. Untuk trafik tinggi sebaiknya pakai database relasional.