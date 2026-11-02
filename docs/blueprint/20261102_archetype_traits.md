---
title: "Blueprint: MBTI-Style Archetype Traits"
type: blueprint
parent_intent: docs/intent/20261102_archetype_traits.md
status: Approved
last_updated: 2026-11-02
---

# Blueprint: MBTI-Style Archetype Traits

Desain ini mengimplementasikan sistem identitas kepribadian panggung 31 arketipe berbasis 5 kategori atribut intrinsik (`vocal`, `rap`, `dance`, `stage`, `visual`) langsung di dalam modul mesin kalkulasi [src/engine/ovr.ts](file:///home/eds/Code/k-profile/src/engine/ovr.ts), serta mengganti secara penuh panel `"How this rating is built"` pada [src/pages/IdolDetail.tsx](file:///home/eds/Code/k-profile/src/pages/IdolDetail.tsx) menjadi panel Archetype Trait tanpa perubahan skema basis data.

## Current Code

Saat ini [src/engine/ovr.ts](file:///home/eds/Code/k-profile/src/engine/ovr.ts#L211-L215) sudah menghitung skor 5 kategori induk (`cats: Record<CategoryKey, number>`) melalui [`categoryScores`](file:///home/eds/Code/k-profile/src/engine/ovr.ts#L211-L215) di dalam [`computeOvr`](file:///home/eds/Code/k-profile/src/engine/ovr.ts#L240-L282), tetapi belum memetakan kelima nilai kategori tersebut ke dalam arketipe sifat (archetype trait). Di sisi tampilan, [src/pages/IdolDetail.tsx](file:///home/eds/Code/k-profile/src/pages/IdolDetail.tsx#L155-L196) merender `<Panel title="How this rating is built">` di sebelah kanan `<PentagonChart />` yang menampilkan rincian `breakdown.roleScores`, `Role-weighted base`, `Popularity drift`, dan `Overall`.

## Design

Sesuai prinsip Locality of Behavior dan Deep Modules, seluruh katalog 31 arketipe (`ARCHETYPES`) dan fungsi evaluasinya (`computeArchetype`) ditempatkan langsung di dalam [src/engine/ovr.ts](file:///home/eds/Code/k-profile/src/engine/ovr.ts) tanpa membuat file atau lapisan abstraksi baru.

Alur eksekusi bekerja sebagai berikut:
1. Kelima kategori dievaluasi mengikuti urutan kanonik `CATEGORIES`: `["vocal", "rap", "dance", "stage", "visual"]`.
2. Dari `cats: Record<CategoryKey, number>`, fungsi [`computeArchetype`](file:///home/eds/Code/k-profile/src/engine/ovr.ts) menghitung nilai tertinggi (`max`), nilai terendah (`min`), dan batas titik tengah `threshold = (max + min) / 2`.
3. Kategori yang memenuhi `cats[key] >= threshold` dikumpulkan secara berurutan ke dalam `activeCategories` dan digabungkan dengan pemisah `"+"` menjadi kunci kanonik (misalnya `"vocal+dance+stage"`).
4. Kunci kanonik tersebut dicocokkan secara deterministik ke kamus konstan `ARCHETYPES` (31 entri Opsi 2 — Nada Persona Panggung).
5. [`computeOvr`](file:///home/eds/Code/k-profile/src/engine/ovr.ts#L240-L282) menyertakan hasil `archetype` di dalam objek `OvrBreakdown`, yang kemudian dikonsumsi langsung oleh [src/pages/IdolDetail.tsx](file:///home/eds/Code/k-profile/src/pages/IdolDetail.tsx) untuk menggantikan panel `"How this rating is built"`.

## Contracts

### BP-ARCH-001: 31-Type Archetype Catalog & 5-Axis Midrange Calculation (`ARCHETYPES`, `computeArchetype`, `computeOvr`)
- Serves: Pemetaan deterministik 5 sumbu atribut intrinsik ke dalam katalog 31 gelar arketipe (Opsi 2 — Persona Panggung) dengan kosakata kata benda inti yang 100% unik melalui seleksi batas titik tengah `(max + min) / 2` di sisi front-end.
- Input: `cats: Record<CategoryKey, number>` (nilai 5 kategori `vocal`, `rap`, `dance`, `stage`, `visual` dalam rentang `50..99`).
- Behavior:
  1. `ARCHETYPES` mendefinisikan tepat 31 entri kombinasi biner non-kosong dari `["vocal", "rap", "dance", "stage", "visual"]`, masing-masing berisi `{ title: string; description: string }` sesuai katalog Opsi 2 pada Intent.
  2. `computeArchetype(cats)` memverifikasi kelima nilai kategori adalah angka berhingga (`Number.isFinite`), menghitung `max`, `min`, dan `threshold = (max + min) / 2`.
  3. Menyaring `CATEGORIES` untuk mengambil seluruh `key` dengan `cats[key] >= threshold` ke dalam `activeCategories`, membentuk `key = activeCategories.join("+")`, dan mengambil definisi arketipe dari `ARCHETYPES[key]`.
  4. `computeOvr(idol, cfg)` memanggil `computeArchetype(cats)` dan mengembalikannya pada properti `archetype` di dalam `OvrBreakdown`.
- Output: `ArchetypeResult` (`{ key: string; title: string; description: string; threshold: number; activeCategories: CategoryKey[] }`), tersedia juga melalui `OvrBreakdown.archetype`.
- Failure: Jika ada kategori pada `cats` yang tidak bernilai angka berhingga (`!Number.isFinite(cats[k])`) atau jika `key` tidak ditemukan di dalam `ARCHETYPES`, `computeArchetype` langsung melempar `Error` eksplisit (`"Invalid category scores for archetype calculation"` atau `"Unknown archetype key: " + key`) tanpa fallback diam-diam.
- Verification: Automated test melalui public API (`ARCHETYPES`, `computeArchetype`, `computeOvr`) di [src/engine/ovr.test.ts](file:///home/eds/Code/k-profile/src/engine/ovr.test.ts) yang memverifikasi ke-31 entri katalog, keunikan kata benda inti pada seluruh 31 `title`, akurasi seleksi `(max + min) / 2` dari 1 hingga 5 sumbu aktif (termasuk kasus atribut seragam `max === min`), serta pelemparan error eksplisit pada input tidak valid.

### BP-ARCH-002: Full Replacement of "How this rating is built" Panel ([src/pages/IdolDetail.tsx](file:///home/eds/Code/k-profile/src/pages/IdolDetail.tsx))
- Serves: Penggantian penuh panel `"How this rating is built"` di sebelah kanan grafik pentagon pada halaman detail idol menjadi panel Archetype Trait.
- Input: `breakdown = computeOvr(idol, config)` di [src/pages/IdolDetail.tsx](file:///home/eds/Code/k-profile/src/pages/IdolDetail.tsx#L14-L17).
- Behavior:
  1. Mengganti `<Panel title="How this rating is built">` ([src/pages/IdolDetail.tsx](file:///home/eds/Code/k-profile/src/pages/IdolDetail.tsx#L155-L196)) beserta seluruh tampilan `breakdown.roleScores`, `Role-weighted base`, `Popularity drift`, dan catatan kaki lamanya menjadi `<Panel title="Archetype trait">`.
  2. Menampilkan gelar arketipe (`breakdown.archetype.title`) dan deskripsi persona panggungnya dalam bahasa Inggris (`breakdown.archetype.description`).
  3. Menampilkan daftar kategori atribut yang aktif (`breakdown.archetype.activeCategories`) sebagai chips/badges murni beserta label pilar (`${breakdown.archetype.activeCategories.length} of 5 pillars`), tanpa progress bar statistik, nilai angka stat, maupun catatan kaki rumus matematika.
- Output: Panel Archetype Trait yang ter-render menggantikan panel lama di sebelah kanan `PentagonChart` pada halaman detail idol.
- Failure: Bila data `idol` tidak ditemukan, komponen tetap berhenti di guard clause awal `IdolDetail` ([src/pages/IdolDetail.tsx](file:///home/eds/Code/k-profile/src/pages/IdolDetail.tsx#L27-L39)).
- Verification: Pemeriksaan tipe statis (`npx tsc --noEmit`), build produksi (`npm run build`), dan verifikasi visual antarmuka pada tahap implementasi (`/design` dan `/proof`).

## Non-Goals
- Tidak membuat tabel, kolom, atau migrasi baru di basis data Supabase.
- Tidak mempertahankan daftar `roleScores`, `Role-weighted base`, atau `Popularity drift` di dalam panel sebelah grafik pentagon pada [src/pages/IdolDetail.tsx](file:///home/eds/Code/k-profile/src/pages/IdolDetail.tsx).
- Tidak mengubah rumus perhitungan angka `ovr` di [`computeOvr`](file:///home/eds/Code/k-profile/src/engine/ovr.ts#L240-L282).
- Tidak menambahkan tampilan atau filter arketipe pada `PhotoCard`, `ScoutingTable`, `Binder`, atau `Compare`.
- Tidak menggunakan peran administratif/fungsional (`center`, `leader`) sebagai sumbu penentu arketipe.
