---
title: "Intent: MBTI-Style Archetype Traits"
type: intent
last_updated: 2026-11-02
---

# Intent: MBTI-Style Archetype Traits

Statistik angka atribut dan peran fungsional idol sering kali terasa dingin jika hanya dibaca sebagai angka-angka mentah. Kita ingin memberikan identitas kepribadian panggung bagi setiap idol berupa sifat arketipe (archetype trait) berformat "The ..." yang terinspirasi dari sistem MBTI, tetapi berakar murni pada domain kemampuan idol.

Gelar ini menggunakan **Nada Persona Panggung (Opsi 2)** yang langsung merangkum gaya performa dan fungsi idol di panggung begitu namanya didengar, tanpa istilah ambigu atau metafora yang terlalu abstrak.

## Cara Kerja Sistem

Sistem arketipe ini dihitung secara langsung di sisi front-end (runtime di dalam mesin kalkulasi [src/engine/ovr.ts](file:///home/eds/Code/k-profile/src/engine/ovr.ts)) dengan mengevaluasi 5 kategori atribut dasar idol (Vocal, Rap, Dance, Stage Presence, Visual) secara objektif dan matematis:

1. **Evaluasi 5 Sumbu Atribut**: Sistem membaca nilai akhir 5 kategori atribut intrinsik (`cats`) milik idol.
2. **Seleksi Batas Titik Tengah (`(max + min) / 2`)**: Dari 5 nilai kategori tersebut, sistem mencari nilai tertinggi (`max`) dan terendah (`min`), lalu menetapkan batas ambang keaktifan: `threshold = (max + min) / 2`.
3. **Penentuan Keaktifan Sumbu**: Kategori dengan nilai `>= threshold` dinyatakan aktif (bernilai 1), sedangkan yang di bawah ambang dinyatakan non-aktif (bernilai 0). Karena `max` selalu `>= threshold`, minimal selalu ada 1 atribut yang aktif.
4. **Pemetaan ke 31 Tipe Arketipe Katalog**: Kombinasi biner dari 5 sumbu aktif ini menghasilkan tepat 31 pola kemungkinan (`2⁵ - 1`). Setiap pola dipetakan ke 1 gelar arketipe resmi yang terkurasi.
5. **Penampilan di Antarmuka (Menggantikan Panel "How this rating is built")**: Pada halaman detail idol ([src/pages/IdolDetail.tsx](file:///home/eds/Code/k-profile/src/pages/IdolDetail.tsx)), panel `"How this rating is built"` di sebelah kanan grafik pentagon diganti secara penuh menjadi panel Archetype Trait yang menampilkan gelar `"The ..."`, deskripsi fungsinya, serta rincian atribut kategori yang aktif melewati batas titik tengah.

## Katalog 31 Arketipe (Opsi 2 — Persona Panggung)

Setiap gelar diawali dengan "The ..." dan memiliki kata benda inti (primary noun) yang unik tanpa ada pengulangan kata kunci:

### Lapisan 1: Spesialis Murni (1 Sumbu Aktif — 5 Tipe)
- Vokal (V): **The Vocal Maestro** (Penguasa teknik suara murni)
- Rap (R): **The Wordsmith** (Penenun rima, tempo, dan lirik)
- Dance (D): **The Dance Dynamo** (Penari murni berenergi kinetik tinggi)
- Stage Presence (S): **The Stage Commander** (Pengendali formasi dan pusat gravitasi panggung)
- Visual (Vis): **The Visual Muse** (Inspirasi estetika visual dan pesona kamera)

### Lapisan 2: Dua Keahlian / Dual Focus (2 Sumbu Aktif — 10 Tipe)
- V + R: **The Melodic Rapper** (Keahlian berimbang antara menyanyi merdu dan melantunkan rap)
- V + D: **The Stage Engine** (Motor penggerak penampilan langsung yang stabil)
- V + S: **The Vocal Anchor** (Pondasi suara utama dengan karisma panggung dominan)
- V + Vis: **The Visual Siren** (Penyanyi dengan daya pikat vokal dan visual menawan)
- R + D: **The Rhythm Striker** (Penyerang ritme cepat lewat tarian tajam dan rap)
- R + S: **The Stage Disruptor** (Rapper yang mendominasi dan menggebrak suasana panggung)
- R + Vis: **The Trendsetter** (Rapper berpenampilan khas yang memimpin gaya dan tren grup)
- D + S: **The Pacesetter** (Penari berenergi tinggi yang mengatur tempo panggung seluruh grup)
- D + Vis: **The Graceful Performer** (Penari dengan ekspresi panggung dan estetika gerak yang memikat)
- S + Vis: **The Centerpiece** (Pusat perhatian visual dan karisma yang menjadi representasi panggung)

### Lapisan 3: Tiga Keahlian / Triple Threat (3 Sumbu Aktif — 10 Tipe)
- V + R + D: **The Powerhouse** (Segitiga kemampuan teknis musikal dan koreografi murni)
- V + R + S: **The Frontline Virtuoso** (Musisi panggung lengkap di garis depan)
- V + R + Vis: **The Melodic Icon** (Musisi vokal-rap dengan representasi citra visual kuat)
- V + D + S: **The Showstopper** (Pencuri perhatian utama panggung lewat lagu, koreo, dan aksi panggung)
- V + D + Vis: **The Radiant Showman** (Paket penampil klasik dengan vokal prima, tari, dan visual)
- V + S + Vis: **The Headliner** (Nama utama yang memimpin sorotan lewat suara, aura visual, dan karisma)
- R + D + S: **The Crowd Igniter** (Pemicu antusiasme penonton lewat rap, koreo agresif, dan kontrol panggung)
- R + D + Vis: **The Stage Maverick** (Penampil berkarakter bebas dengan rap, koreo tajam, dan gaya khas)
- R + S + Vis: **The Frontman** (Juru bicara dan wajah utama panggung bergenre ritmis)
- D + S + Vis: **The Stage Sensation** (Koreografi, karisma, dan visual spektakuler di panggung)

### Lapisan 4: Empat Keahlian / Quad Focus (4 Sumbu Aktif — 5 Tipe)
- V + R + D + Vis (Minus S): **The Technical Prodigy** (Berbakat luar biasa di empat lini teknis dan visual tanpa dominasi kontrol panggung)
- V + R + D + S (Minus Vis): **The Stage Vanguard** (Garda terdepan performa panggung dengan kemampuan teknis dan karisma mutlak)
- V + R + S + Vis (Minus D): **The Luminary** (Tokoh panggung yang bersinar lewat suara, lirik, visual, dan karisma)
- V + D + S + Vis (Minus R): **The Protagonist** (Sosok sentral ala tokoh utama idol: vokal, tari, aura panggung, dan visual)
- R + D + S + Vis (Minus V): **The Trailblazer** (Pembuka jalan panggung berenergi ritmis, koreo tajam, dan pesona visual)

### Lapisan 5: Sempurna / All Pillars (5 Sumbu Aktif — 1 Tipe)
- V + R + D + S + Vis: **The All-Rounder** (Penguasa seluruh lima dimensi atribut kemampuan idol)

## Apa yang Kita Inginkan
- **Gelar Fungsional Spontan (Opsi 2)**: Nama diawali dengan "The ..." dengan nada persona panggung yang langsung memperjelas fungsi idol saat didengar.
- **Kosakata Unik Mandiri**: Kata kunci utama (seperti Dynamo, Virtuoso, Commander, Engine) hanya digunakan tepat satu kali di dalam seluruh katalog 31 nama.
- **Murni Atribut Intrinsik di Front-End**: Dihitung langsung di sisi front-end dari 5 kategori atribut asli (Vocal, Rap, Dance, Stage Presence, Visual) tanpa mengubah skema database.
- **Menggantikan Panel "How this rating is built" Secara Penuh**: Panel di samping grafik pentagon pada halaman detail idol diganti penuh menjadi panel Archetype Trait.
- **Deterministik**: Satu profil atribut idol selalu menghasilkan satu gelar arketipe yang pasti.

## Apa yang Kita Hindari (Non-Goals)
- Tidak menyimpan gelar arketipe ke dalam tabel database Supabase (tidak ada migrasi SQL).
- Tidak mempertahankan isi lama panel `"How this rating is built"` (daftar `roleScores`, `Role-weighted base`, dan `Popularity drift` pada panel tersebut diganti penuh oleh tampilan Archetype Trait).
- Tidak menampilkan gelar arketipe di komponen lain di luar panel halaman detail idol (tidak mengubah `PhotoCard`, `ScoutingTable`, `Binder`, atau `Compare` pada cakupan ini).
- Tidak memasukkan Center atau Leader sebagai sumbu arketipe.
- Tidak memaksakan kode akronim 4 huruf ala MBTI (seperti ENFP/INTJ).
- Tidak membiarkan ada kata kunci gelar yang berulang antar-arketipe.
