// ------------------------------------------------------------
// SUROWCE I MINERAŁY - jedna tabela dla całej gry.
// Żeby dodać nowy surowiec, dopisz wiersz NA KOŃCU (numery bloków
// są w zapisach graczy) i wstaw go do którejś kopalni w src/mines.js.
//
//   id       - numer bloku
//   klucz    - nazwa w kodzie i nazwa tekstury
//   nazwa    - nazwa dla gracza
//   rodzaj   - 'paliwo', 'metal', 'klejnot' albo 'mineral'
//   twardosc - sekundy kopania drewnianym kilofem
//   poziom   - najsłabszy kilof, który go ruszy (0 = drewniany ... 5 = diamentowy)
//   wartosc  - monety za sztukę
//   skala    - w jakiej skale siedzi na teksturze
//   kolor    - [r, g, b]
//   styl     - jak wygląda w skale: 'brylki', 'krysztaly', 'zyly',
//              'ziarna', 'warstwy', 'teczowy'
//   blysk    - jasny refleks (kamienie szlachetne)
// ------------------------------------------------------------
const m = (id, klucz, nazwa, rodzaj, twardosc, poziom, wartosc, skala, kolor, styl, blysk = false) =>
    ({ id, klucz, nazwa, rodzaj, twardosc, poziom, wartosc, skala, kolor, styl, blysk });

export const MINERALY = [
    // --- od pierwszej wersji gry ---
    m(9, 'wegiel', 'Węgiel', 'paliwo', 1.5, 0, 5, 'kamien', [30, 30, 36], 'brylki'),
    m(10, 'miedz', 'Miedź', 'metal', 2.0, 1, 12, 'kamien', [214, 120, 62], 'brylki'),
    m(11, 'zelazo', 'Żelazo', 'metal', 2.6, 2, 25, 'kamien', [206, 168, 138], 'brylki'),
    m(12, 'srebro', 'Srebro', 'metal', 3.4, 3, 60, 'lupek', [226, 232, 242], 'brylki'),
    m(13, 'zloto', 'Złoto', 'metal', 3.8, 3, 120, 'lupek', [250, 206, 60], 'brylki'),
    m(14, 'szmaragd', 'Szmaragd', 'klejnot', 5.0, 4, 250, 'bazalt', [40, 214, 112], 'brylki', true),
    m(15, 'rubin', 'Rubin', 'klejnot', 5.5, 4, 400, 'bazalt', [228, 44, 74], 'brylki', true),
    m(16, 'diament', 'Diament', 'klejnot', 7.0, 5, 800, 'bazalt', [112, 236, 246], 'brylki', true),
    // --- drewniany kilof ---
    m(31, 'sol', 'Sól kamienna', 'mineral', 1.0, 0, 3, 'kamien', [238, 232, 224], 'ziarna'),
    m(32, 'krzemien', 'Krzemień', 'mineral', 1.6, 0, 4, 'wapien', [72, 66, 76], 'brylki'),
    m(33, 'siarka', 'Siarka', 'mineral', 1.2, 0, 7, 'piaskowiec', [238, 216, 56], 'ziarna'),
    // --- kamienny kilof ---
    m(34, 'cyna', 'Cyna', 'metal', 2.0, 1, 10, 'kamien', [178, 190, 198], 'zyly'),
    m(35, 'olow', 'Ołów', 'metal', 2.2, 1, 14, 'kamien', [92, 100, 130], 'krysztaly'),
    m(36, 'kwarc', 'Kwarc', 'mineral', 2.2, 1, 16, 'granit', [242, 240, 250], 'krysztaly', true),
    // --- miedziany kilof ---
    m(37, 'cynk', 'Cynk', 'metal', 2.6, 2, 20, 'kamien', [120, 176, 150], 'zyly'),
    m(38, 'saletra', 'Saletra', 'mineral', 2.2, 2, 18, 'piaskowiec', [232, 238, 222], 'zyly'),
    m(39, 'nikiel', 'Nikiel', 'metal', 2.8, 2, 28, 'granit', [176, 190, 136], 'brylki'),
    m(40, 'malachit', 'Malachit', 'mineral', 2.8, 2, 35, 'kamien', [28, 164, 112], 'warstwy'),
    m(41, 'bursztyn', 'Bursztyn', 'klejnot', 2.4, 2, 40, 'piaskowiec', [242, 158, 36], 'brylki', true),
    // --- żelazny kilof ---
    m(42, 'lazuryt', 'Lazuryt', 'mineral', 3.2, 3, 70, 'lupek', [44, 74, 190], 'ziarna'),
    m(43, 'kobalt', 'Kobalt', 'metal', 3.4, 3, 80, 'lupek', [70, 110, 230], 'zyly'),
    m(44, 'ametyst', 'Ametyst', 'klejnot', 3.6, 3, 90, 'lupek', [168, 96, 228], 'krysztaly', true),
    m(45, 'jadeit', 'Jadeit', 'klejnot', 3.6, 3, 110, 'lupek', [116, 196, 136], 'warstwy'),
    m(46, 'topaz', 'Topaz', 'klejnot', 3.8, 3, 140, 'granit', [255, 150, 108], 'krysztaly', true),
    // --- stalowy kilof ---
    m(47, 'wolfram', 'Wolfram', 'metal', 4.8, 4, 220, 'bazalt', [140, 150, 172], 'zyly'),
    m(48, 'tytan', 'Tytan', 'metal', 5.0, 4, 260, 'bazalt', [198, 178, 210], 'brylki'),
    m(49, 'platyna', 'Platyna', 'metal', 5.0, 4, 320, 'bazalt', [224, 228, 234], 'ziarna'),
    m(50, 'opal', 'Opal', 'klejnot', 5.2, 4, 380, 'marmur', [206, 232, 240], 'teczowy', true),
    m(51, 'szafir', 'Szafir', 'klejnot', 5.5, 4, 450, 'bazalt', [44, 96, 236], 'krysztaly', true),
    // --- diamentowy kilof ---
    m(52, 'iryd', 'Iryd', 'metal', 7.5, 5, 1200, 'bazalt', [232, 242, 255], 'ziarna', true),
    m(53, 'aleksandryt', 'Aleksandryt', 'klejnot', 8.0, 5, 1600, 'marmur', [150, 64, 170], 'krysztaly', true)
];

// Skały bez wartości (z nich zbudowane są warstwy kopalni).
//   id, klucz, nazwa, twardosc, poziom, kolor, wygląd tekstury
export const SKALY = [
    { id: 27, klucz: 'granit', nazwa: 'Granit', twardosc: 1.9, poziom: 1, kolor: [150, 124, 122], wyglad: { odcienie: 5, kontrast: 0.5, pekniecia: 0.004, drobinki: 0.2 } },
    { id: 28, klucz: 'wapien', nazwa: 'Wapień', twardosc: 1.0, poziom: 0, kolor: [196, 190, 170], wyglad: { odcienie: 4, kontrast: 0.28, pekniecia: 0.008, drobinki: 0.02 } },
    { id: 29, klucz: 'piaskowiec', nazwa: 'Piaskowiec', twardosc: 0.9, poziom: 0, kolor: [200, 164, 110], wyglad: { odcienie: 5, kontrast: 0.3, pekniecia: 0, drobinki: 0.12, pasy: true } },
    { id: 30, klucz: 'marmur', nazwa: 'Marmur', twardosc: 3.0, poziom: 3, kolor: [214, 212, 220], wyglad: { odcienie: 4, kontrast: 0.22, pekniecia: 0.02, drobinki: 0.01 } }
];

export const RODZAJE = { paliwo: 'Paliwa', metal: 'Metale', klejnot: 'Kamienie szlachetne', mineral: 'Minerały' };
