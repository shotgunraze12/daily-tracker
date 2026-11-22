# Tracker Rumah

Dashboard untuk 2 orang di Cloudflare Pages (pages.dev). Isinya stok barang (galon, beras, telur, dll), kebiasaan harian bersama (misal minum air), dan kebiasaan pribadi per user (misal kreatin).

Isi folder:

- `public/index.html` : tampilan dashboard
- `functions/api/[[path]].js` : backend (Pages Function)
- `schema.sql` : struktur database D1
- `wrangler.toml` : konfigurasi proyek

## Deploy

Butuh Node.js dan akun Cloudflare (gratis).

1. Masuk ke folder ini, lalu login:
   ```
   npx wrangler login
   ```
2. Buat database:
   ```
   npx wrangler d1 create tracker-db
   ```
   Salin `database_id` dari hasilnya, lalu tempel ke `wrangler.toml` menggantikan `ISI_DENGAN_DATABASE_ID`.
3. Buat tabel di database online:
   ```
   npx wrangler d1 execute tracker-db --remote --file=schema.sql
   ```
4. Deploy:
   ```
   npx wrangler pages deploy public --project-name tracker-rumah
   ```
   Alamatnya jadi `https://tracker-rumah.pages.dev`.

## Pasang login (wajib, jangan dilewati)

Backend mengenali user dari header yang dipasang Cloudflare Access. Selama Access belum aktif, alamat itu belum aman.

1. Buka Cloudflare dashboard, pilih Zero Trust, lalu Access, Applications, Add an application, Self-hosted.
2. Isi domain `tracker-rumah.pages.dev`. Tambahkan juga `*.tracker-rumah.pages.dev` supaya alamat preview ikut terlindungi.
3. Buat policy Allow dengan Include: Emails, isi 2 email kalian.
4. Pastikan metode login One-time PIN aktif. Saat buka situs, kode akan dikirim ke email.

Tambahan pengaman (opsional): di Pages, Settings, Variables and Secrets, buat variabel `ALLOWED_EMAILS` berisi `email1@x.com,email2@y.com`.

## Cara pakai

- Tab Stok: catat barang masuk, tekan Habis saat habis. Setelah ada riwayat, dashboard memberi perkiraan kapan barang yang sama habis lagi.
- Tab Harian: kebiasaan bersama (bawaan: minum air 8 gelas). Tiap orang mencatat sendiri.
- Tab Punyaku: kebiasaan pribadi, misal kreatin. Tidak terlihat oleh orang lain.
