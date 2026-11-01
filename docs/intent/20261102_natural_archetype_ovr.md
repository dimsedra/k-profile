---
title: "Intent: Natural Multi-Role Archetype OVR"
type: intent
last_updated: 2026-11-02
---

# Intent: Natural Multi-Role Archetype OVR

Selama ini skor keseluruhan (OVR) dihitung hanya dari peran resmi grup (`idol.roles`) yang diinput manual. Padahal penugasan peran dari agensi sering bersifat administratif dan tidak mencerminkan seluruh bakat seorang idol. Jika idol punya nilai Visual sangat tinggi tetapi di grup hanya ditugaskan sebagai Lead Vocalist, potensi visualnya hampir tidak terhitung dan membuat OVR-nya turun secara tidak adil.

Kita ingin mengubah konsep perhitungan OVR agar membaca kemampuan alami idol secara objektif dan matematis murni dari data atributnya, terlepas dari apa peran administratifnya di grup.

## Apa yang Kita Inginkan
- **Penghapusan Total `allRounder` (Untuk Saat Ini)**: Peran `allRounder` dihapus sepenuhnya dari sistem (basis data, mesin OVR, dan antarmuka). Kemungkinan penambahan kembali `allRounder` sebagai sifat arketipe (archetype trait) dicatat sebagai rencana masa depan, tetapi tidak dikerjakan pada cakupan saat ini.
- **Pool 11 Peran Fungsional**: Penilaian skor OVR murni mengevaluasi 11 peran fungsional aktif: Main/Lead/Sub Vocalist, Main/Lead/Sub Rapper, Main/Lead/Sub Dancer, Visual, dan Center.
- **Seleksi Titik Tengah (`(max + min) / 2`)**: Dari 11 skor peran fungsional idol, sistem mencari nilai tertinggi (`max`) dan terendah (`min`), lalu mengambil seluruh peran yang nilainya `>= (max + min) / 2`.
- **Penyaringan Rumpun Berjenjang & Kemandirian Visual/Center**: Untuk rumpun berjenjang (Vokal, Rap, Dance), jika ada lebih dari satu tingkatan yang lolos batas titik tengah, hanya satu peran dengan skor tertinggi di rumpun tersebut yang dipakai. Sebaliknya, Visual dan Center berdiri mandiri (bukan satu rumpun yang saling mengeliminasi) sehingga keduanya bisa lolos bersamaan.
- **Perhitungan OVR via Ranked Decay & Peran Administratif Tetap Ada**: Peran-peran alami yang lolos penyaringan dihitung menggunakan rumus penyusutan bertingkat (ranked geometric decay) untuk menghasilkan OVR. Peran resmi grup (`idol.roles`) tetap disimpan untuk konteks profil grup, tetapi tidak lagi mengunci OVR.

## Apa yang Kita Hindari (Non-Goals)
- Tidak mengunci perhitungan OVR pada peran manual (`idol.roles`).
- Tidak mempertahankan peran `allRounder` dalam bentuk apa pun di dalam sistem saat ini.
- Tidak mengimplementasikan sistem archetype traits untuk `allRounder` saat ini (ditunda untuk masa depan).
- Tidak menyatukan Visual dan Center sebagai satu rumpun yang saling menggugurkan.
- Tidak meloloskan dua peran dari rumpun berjenjang yang sama (misalnya Main Vocalist dan Lead Vocalist sekaligus).
- Tidak membangun sistem penamaan gelar arketipe tematik ala MBTI pada cakupan ini.
