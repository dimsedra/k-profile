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
5. **Penampilan di Antarmuka (Menggantikan Panel "How this rating is built" Secara Penuh)**: Pada halaman detail idol ([src/pages/IdolDetail.tsx](file:///home/eds/Code/k-profile/src/pages/IdolDetail.tsx)), panel `"How this rating is built"` di sebelah kanan grafik pentagon diganti secara penuh menjadi panel Archetype Trait murni. Panel ini menampilkan gelar `"The ..."`, deskripsi persona panggung dalam bahasa Inggris yang konsisten dengan antarmuka, serta daftar pilar aktif sebagai chips/badges tanpa ada progress bar statistik, angka skor, maupun catatan kaki rumus matematika.

## Katalog 31 Arketipe (Opsi 2 — Persona Panggung)

Setiap gelar diawali dengan "The ...", memiliki kata benda inti (primary noun) yang unik tanpa ada pengulangan kata kunci, dan deskripsi persona panggung berbahasa Inggris:

### Lapisan 1: Spesialis Murni (1 Sumbu Aktif — 5 Tipe)
- Vokal (V): **The Vocal Maestro** — *Master of vocal technique and tonal expression, anchoring the group's sonic identity.*
- Rap (R): **The Wordsmith** — *Rhythm and flow architect, delivering intricate cadences and razor-sharp lyricism.*
- Dance (D): **The Dance Dynamo** — *Kinetic powerhouse with exceptional precision, athleticism, and choreographic execution.*
- Stage Presence (S): **The Stage Commander** — *Natural live authority commanding audience focus, group formations, and stage gravity.*
- Visual (Vis): **The Visual Muse** — *Striking aesthetic presence and camera magnetism, embodying the visual concept of the group.*

### Lapisan 2: Dua Keahlian / Dual Focus (2 Sumbu Aktif — 10 Tipe)
- V + R: **The Melodic Rapper** — *Seamlessly blends melodic vocal delivery with fast, articulate rap verses.*
- V + D: **The Stage Engine** — *High-stamina live motor executing demanding choreography while preserving vocal stability.*
- V + S: **The Vocal Anchor** — *Commanding live vocalist who electrifies the stage with undeniable vocal charisma.*
- V + Vis: **The Visual Siren** — *Enchanting vocal presence paired with irresistible camera charisma and visual elegance.*
- R + D: **The Rhythm Striker** — *Explosive performer driving high-tempo tracks through aggressive rap flows and sharp dance moves.*
- R + S: **The Stage Disruptor** — *Bold, unpredictable presence bringing ferocious energy and commanding the stage through rap.*
- R + Vis: **The Trendsetter** — *Distinctive stylist with sharp rap cadence, defining the visual and musical edge of the group.*
- D + S: **The Pacesetter** — *Charismatic lead dancer setting the choreographic standard and driving live energy.*
- D + Vis: **The Graceful Performer** — *Mesmerizing dancer pairing fluid lines and precision with striking camera presence.*
- S + Vis: **The Centerpiece** — *Magnetic live presence that naturally draws every eye and anchors the stage aesthetic.*

### Lapisan 3: Tiga Keahlian / Triple Threat (3 Sumbu Aktif — 10 Tipe)
- V + R + D: **The Powerhouse** — *Musical and physical triple threat executing complex vocals, verses, and choreography.*
- V + R + S: **The Frontline Virtuoso** — *Complete musical frontliner dominating live performances through vocal, rap, and stage control.*
- V + R + Vis: **The Melodic Icon** — *Versatile vocal-rap artist with standout visual appeal and undeniable star aura.*
- V + D + S: **The Showstopper** — *Electric live performer stealing the spotlight with powerhouse vocals and stage mastery.*
- V + D + Vis: **The Radiant Showman** — *Classic all-around idol packaging polished vocals, graceful dance, and luminous visual appeal.*
- V + S + Vis: **The Headliner** — *Marquee artist captivating crowds with soaring vocals, stage charisma, and camera presence.*
- R + D + S: **The Crowd Igniter** — *Fierce rhythm specialist firing up audiences with blistering flows, hard-hitting moves, and wild energy.*
- R + D + Vis: **The Stage Maverick** — *Free-spirited performer combining street dance, rhythmic rap delivery, and striking visual attitude.*
- R + S + Vis: **The Frontman** — *Charismatic spokesperson and visual center driving the group's sonic and visual identity.*
- D + S + Vis: **The Stage Sensation** — *Visual and choreographic spectacle commanding center stage with dramatic flair.*

### Lapisan 4: Empat Keahlian / Quad Focus (4 Sumbu Aktif — 5 Tipe)
- V + R + D + Vis (Minus S): **The Technical Prodigy** — *Gifted all-around talent mastering vocals, rap, dance, and visuals across every performance.*
- V + R + D + S (Minus Vis): **The Stage Vanguard** — *Formidable performance leader possessing complete technical command over music, dance, and stagecraft.*
- V + R + S + Vis (Minus D): **The Luminary** — *Radiant artist shining through expressive vocals, rap verses, visual aura, and stage poise.*
- V + D + S + Vis (Minus R): **The Protagonist** — *The quintessential center idol commanding vocal lines, choreography, stage aura, and visual magnetism.*
- R + D + S + Vis (Minus V): **The Trailblazer** — *Dynamic pioneer spearheading intense performances with rap precision, dance energy, and visual star power.*

### Lapisan 5: Sempurna / All Pillars (5 Sumbu Aktif — 1 Tipe)
- V + R + D + S + Vis: **The All-Rounder** — *Unrivaled master excelling across every single pillar of idol craft.*

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
