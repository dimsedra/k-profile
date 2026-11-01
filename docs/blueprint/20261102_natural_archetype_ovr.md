---
title: "Blueprint: Natural Multi-Role Archetype OVR Engine"
type: blueprint
parent_intent: docs/intent/20261102_natural_archetype_ovr.md
status: Draft
last_updated: 2026-11-02
---

# Blueprint: Natural Multi-Role Archetype OVR Engine

Desain ini memutus ketergantungan [`computeOvr`](file:///home/eds/Code/k-profile/src/engine/ovr.ts#L217-L245) dari properti administratif `idol.roles` dan menghapus `allRounder` sepenuhnya dari sistem saat ini, sehingga skor keseluruhan (OVR) dihitung murni dari evaluasi ke-11 peran fungsional terhadap atribut idol melalui seleksi batas titik tengah `(max + min) / 2`, de-duplikasi per rumpun keahlian, dan penyusutan bobot geometris (`roleDecay`). Rencana penambahan `allRounder` sebagai sifat arketipe (archetype trait) dikesampingkan dan dicatat untuk masa depan.

## Current Code

Saat ini [src/engine/ovr.ts](file:///home/eds/Code/k-profile/src/engine/ovr.ts#L220-L238) hanya mengevaluasi peran yang tercantum di dalam `idol.roles`, sehingga atribut tinggi di luar peran resmi grup tidak terhitung dalam OVR. Selain itu, `allRounder` masih terdaftar sebagai peran di `ROLES` ([src/engine/ovr.ts](file:///home/eds/Code/k-profile/src/engine/ovr.ts#L99)), digunakan sebagai fallback diam-diam di [`roleScore`](file:///home/eds/Code/k-profile/src/engine/ovr.ts#L201) (`cfg.roleMatrix[roleId] ?? cfg.roleMatrix.allRounder`), menjadi nilai awal form di [src/pages/IdolForm.tsx](file:///home/eds/Code/k-profile/src/pages/IdolForm.tsx#L34), menjadi fallback label di [src/pages/Home.tsx](file:///home/eds/Code/k-profile/src/pages/Home.tsx#L113), serta tercatat di constraint `idol_roles_role_id_check` dan JSONB `engine_config.role_matrix` pada [supabase/migrations/20260930140000_sub_roles.sql](file:///home/eds/Code/k-profile/supabase/migrations/20260930140000_sub_roles.sql).

## Design

Seluruh perubahan perhitungan OVR ditempatkan tetap di dalam satu modul [src/engine/ovr.ts](file:///home/eds/Code/k-profile/src/engine/ovr.ts) tanpa menambah file atau lapisan abstraksi baru, sementara sanitasi data dari basis data tetap berada di perbatasan masuk [src/store.tsx](file:///home/eds/Code/k-profile/src/store.tsx) (`sanitizeEngine` dan `toIdol`).

Untuk menangani penyaringan rumpun berjenjang (Vokal, Rap, Dance) sekaligus menjaga kemandirian `visual` dan `center` tanpa percabangan khusus, ke-11 peran fungsional yang dinilai dipetakan ke dalam `family`:
- Rumpun `"vocal"`, `"rap"`, dan `"dance"` masing-masing menaungi 3 peran berjenjang (`main*`, `lead*`, `sub*`).
- Peran `visual` memiliki rumpun `"visual"` dan `center` memiliki rumpun `"center"`, sehingga keduanya tidak saling menggugurkan saat disaring per rumpun.
- `allRounder` dihapus secara total dari kode, skema basis data, dan konfigurasi engine (tidak ada trait system yang dibangun pada iterasi ini).

## Contracts

### BP-OVR-001: Functional Role Pool & Role Scoring (`SCORING_ROLES`, `roleScore`)
- Serves: Pool 11 peran fungsional murni, penghapusan total peran `allRounder` dari kode dan konfigurasi, serta pemodelan rumpun berjenjang (`vocal`, `rap`, `dance`) yang terpisah dari peran mandiri (`visual`, `center`).
- Input: `cats: Record<CategoryKey, number>` (nilai 5 kategori hasil Tier 1), `roleId: string`, dan `cfg: EngineConfig` yang telah diparsing melalui `sanitizeEngine` di [src/store.tsx](file:///home/eds/Code/k-profile/src/store.tsx#L119-L158).
- Behavior:
  - `SCORING_ROLES` mendefinisikan tepat 11 peran fungsional (`mainVocal`, `leadVocal`, `subVocalist`, `mainRapper`, `leadRapper`, `subRapper`, `mainDancer`, `leadDancer`, `subDancer`, `visual`, `center`) beserta rumpun keahliannya.
  - `allRounder` dihapus sepenuhnya dari `ROLES` dan `DEFAULT_CONFIG.roleMatrix`.
  - `roleScore(cats, roleId, cfg)` menghitung rata-rata berbobot dari 5 kategori terhadap bobot pada `cfg.roleMatrix[roleId]`.
- Output: `number` berupa skor kecocokan peran dalam rentang `50..99`.
- Failure: Jika `roleId` tidak ditemukan di `cfg.roleMatrix` atau jumlah bobotnya `<= 0`, `roleScore` langsung melempar `Error("Unknown or degenerate role in roleMatrix: " + roleId)` tanpa fallback diam-diam.
- Verification: Automated test melalui public API (`SCORING_ROLES`, `roleScore`) yang memverifikasi daftar tepat 11 peran fungsional, perhitungan skor kategori, dan pelemparan error eksplisit ketika dipanggil dengan `"allRounder"` atau ID peran asing.

### BP-OVR-002: Midrange Archetype Selection & OVR Calculation (`computeOvr`)
- Serves: Perhitungan OVR objektif dari atribut asli tanpa terkunci `idol.roles`, seleksi batas titik tengah `(max + min) / 2`, penyaringan satu varian tertinggi per rumpun berjenjang dengan `visual` dan `center` yang tetap independen, serta kalkulasi OVR via ranked geometric decay.
- Input: `idol: Idol` (hanya membaca `idol.attrs` dan `idol.popularity`; `idol.roles` diabaikan) dan `cfg: EngineConfig`.
- Behavior:
  1. Menghitung nilai 5 kategori `cats = categoryScores(idol, cfg)`.
  2. Menghitung `roleScore` untuk ke-11 peran di `SCORING_ROLES` dan mengurutkannya dari skor tertinggi ke terendah (seri diputus secara deterministik mengikuti urutan kanonik `SCORING_ROLES`).
  3. Menghitung `threshold = (max + min) / 2` dari skor tertinggi (`allScored[0].score`) dan terendah (`allScored[allScored.length - 1].score`).
  4. Menyaring daftar terurut untuk mengambil peran dengan `score >= threshold` yang rumpunnya belum pernah diambil sebelumnya.
  5. Menghitung bobot geometris `Math.pow(cfg.roleDecay, i)` yang dinormalisasi hingga berjumlah `1` pada peran-peran yang lolos (`roleScores`), menjumlahkan `base = sum(score * weight)`, menambahkan `drift = ((idol.popularity - 50) / 50) * cfg.driftMax`, dan membulatkan `ovr` ke rentang `40..99`.
- Output: `OvrBreakdown` (`{ cats, roleScores, base, drift, ovr }`) di mana `roleScores` berisi 1 hingga maksimal 5 peran alami yang lolos beserta bobotnya.
- Failure: Jika `cfg.roleDecay` bukan angka positif yang valid (`!Number.isFinite(cfg.roleDecay) || cfg.roleDecay <= 0`), melempar `Error("Invalid roleDecay in EngineConfig")`.
- Verification: Automated test melalui public API (`computeOvr`) untuk skenario multi-role dengan de-duplikasi rumpun berjenjang (kasus Idol A), skenario `visual` dan `center` lolos bersamaan (kasus Idol B), skenario atribut seragam (`max === min`), serta pengujian invarian bahwa perubahan apa pun pada `idol.roles` tidak mengubah `ovr`, `base`, maupun `roleScores`.

### BP-OVR-003: Complete Removal of `allRounder` from Storage & UI Boundaries
- Serves: Penghapusan total peran `allRounder` dari basis data dan antarmuka saat ini, sambil mempertahankan `idol.roles` sebagai data peran administratif grup di penyimpanan dan tampilan.
- Input: Baris `engine_config` dan `idol_roles` dari Supabase yang diparsing di batas masuk `sanitizeEngine` dan `toIdol` pada [src/store.tsx](file:///home/eds/Code/k-profile/src/store.tsx), serta input form di [src/pages/IdolForm.tsx](file:///home/eds/Code/k-profile/src/pages/IdolForm.tsx).
- Behavior:
  1. Migrasi SQL baru (`supabase/migrations/20261102000000_remove_all_rounder_role.sql`):
     - Menghapus baris `role_id = 'allRounder'` pada `public.idol_roles` (atau mengubahnya menjadi `'mainVocal'` bila itu satu-satunya peran milik idol tersebut agar integritas posisi tetap terjaga).
     - Mengetatkan constraint `idol_roles_role_id_check` agar menolak `'allRounder'`.
     - Menghapus kunci `"allRounder"` dari kolom JSONB `public.engine_config.role_matrix` (`role_matrix = role_matrix - 'allRounder'`).
  2. Di [src/store.tsx](file:///home/eds/Code/k-profile/src/store.tsx), `sanitizeEngine` memvalidasi `role_matrix` terhadap 11 `SCORING_ROLES`, dan `toIdol` menyaring `roles` dari basis data agar hanya memuat ID yang terdaftar di `ROLES`.
  3. Di [src/pages/IdolForm.tsx](file:///home/eds/Code/k-profile/src/pages/IdolForm.tsx#L34), peran awal pada draft idol baru diubah dari `["allRounder"]` menjadi `["mainVocal"]`. Di [src/pages/Home.tsx](file:///home/eds/Code/k-profile/src/pages/Home.tsx#L113), fallback `"allRounder"` pada `roleLabel` diganti menjadi `""`. Di [src/pages/Settings.tsx](file:///home/eds/Code/k-profile/src/pages/Settings.tsx), editor bobot peran mengiterasi `SCORING_ROLES`.
- Output: Data `EngineConfig` dan `Idol` yang bebas secara total dari peran `allRounder`, dengan `idol.roles` tetap tersimpan dan tampil sebagai posisi administratif grup.
- Failure: Upaya menyimpan `role_id = 'allRounder'` ke tabel `public.idol_roles` ditolak oleh PostgreSQL dengan error `23514` (`check_violation`).
- Verification: Pemeriksaan tipe statis (`npx tsc --noEmit`), build produksi (`npm run build`), dan verifikasi skema/migrasi SQL pada tahap `/proof`.

## Non-Goals
- Tidak menggunakan `idol.roles` (peran manual/administratif grup) di dalam perhitungan `computeOvr`.
- Tidak mempertahankan `allRounder` di dalam sistem saat ini (baik di role pool, basis data, maupun UI).
- Tidak mengimplementasikan sistem archetype traits untuk `allRounder` pada cakupan ini (ditunda untuk masa depan).
- Tidak menggabungkan `visual` dan `center` ke dalam satu rumpun yang saling mengeliminasi.
- Tidak meloloskan lebih dari satu peran dari rumpun berjenjang yang sama (`vocal`, `rap`, atau `dance`) ke dalam `roleScores`.
- Tidak membangun fitur penamaan gelar arketipe tematik ala MBTI.
