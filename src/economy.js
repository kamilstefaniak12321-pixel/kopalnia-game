// ------------------------------------------------------------
// GOSPODARKA: urobek w plecaku, sprzedaż, ulepszenia, kopalnie.
// Czysta logika na zwykłym obiekcie stanu (łatwo zapisać i sprawdzić).
// ------------------------------------------------------------
import { BLOCKS, M } from './blocks.js';
import { MINES } from './mines.js';

// surowce - czego oprócz monet trzeba do wytworzenia (klucze z src/minerals.js)
export const KILOFY = [
    { nazwa: 'Drewniany kilof', szybkosc: 1.0, cena: 0, kolor: 0x9a6b3a },
    { nazwa: 'Kamienny kilof', szybkosc: 1.5, cena: 60, kolor: 0x8c8c92, surowce: { krzemien: 4 } },
    { nazwa: 'Miedziany kilof', szybkosc: 2.2, cena: 250, kolor: 0xd6783e, surowce: { miedz: 8, cyna: 4 } },
    { nazwa: 'Żelazny kilof', szybkosc: 3.2, cena: 900, kolor: 0xcfd3d8, surowce: { zelazo: 12, wegiel: 6 } },
    { nazwa: 'Stalowy kilof', szybkosc: 4.6, cena: 3000, kolor: 0x6f8296, surowce: { zelazo: 16, nikiel: 8, wegiel: 10 } },
    { nazwa: 'Diamentowy kilof', szybkosc: 7.0, cena: 12000, kolor: 0x6eecf6, surowce: { wolfram: 6, tytan: 6, szafir: 3 } }
];
export const PLECAKI = [
    { nazwa: 'Płócienna torba', pojemnosc: 20, cena: 0 },
    { nazwa: 'Skórzany plecak', pojemnosc: 40, cena: 150 },
    { nazwa: 'Plecak górniczy', pojemnosc: 80, cena: 700 },
    { nazwa: 'Wzmacniany kosz', pojemnosc: 160, cena: 3000 }
];
// paliwo - na ile sekund pod ziemią starcza pełna lampa
export const LAMPY = [
    { nazwa: 'Świeczka', zasieg: 7, cena: 0, paliwo: 240 },
    { nazwa: 'Lampa naftowa', zasieg: 11, cena: 120, paliwo: 360, surowce: { wegiel: 4 } },
    { nazwa: 'Lampa karbidowa', zasieg: 16, cena: 600, paliwo: 540, surowce: { cynk: 4, siarka: 6 } },
    { nazwa: 'Reflektor górniczy', zasieg: 24, cena: 2500, paliwo: 900, surowce: { kwarc: 6, srebro: 4 } }
];
// Zapasy, które się zużywają: stawiane w kopalni drabiny i pochodnie.
export const ZAPASY = {
    drabiny: { nazwa: 'Drabiny', opis: 'Stawiane przy ścianie — droga w górę z każdej dziury.', ile: 5, cena: 15 },
    pochodnie: { nazwa: 'Pochodnie', opis: 'Stawiane na podłożu — światło, które zostaje w kopalni.', ile: 3, cena: 12 },
    stemple: { nazwa: 'Stemple', opis: 'Stawiane pod kruchym stropem — podparta skała nie spadnie.', ile: 4, cena: 20 },
    dynamit: { nazwa: 'Dynamit', opis: 'Wysadza każdą skałę w promieniu 2 bloków. Odejdź, zanim wybuchnie!', ile: 2, cena: 50,
        przepis: { saletra: 2, siarka: 2, wegiel: 1 } }      // albo za darmo z własnych surowców
};
// Urządzenia szybu: kupowane raz, działają we wszystkich kopalniach.
export const URZADZENIA = {
    wozek: { nazwa: 'Wózek', opis: 'Przy szybie wyślesz urobek na powierzchnię i kopiesz dalej z pustym plecakiem.', cena: 400 },
    winda: { nazwa: 'Winda', opis: 'Przy szybie zjedziesz od razu na wybrany poziom i wrócisz na górę.', cena: 800 }
};
const LISTY = { kilof: KILOFY, plecak: PLECAKI, lampa: LAMPY };

export function nowyStan() {
    return { kasa: 0, kilof: 0, plecak: 0, lampa: 0, kopalnie: [0], kopalnia: 0, ziarno: 1, przedmioty: {}, odkryte: {}, drabiny: 8, pochodnie: 4, paliwo: LAMPY[0].paliwo,
        stemple: 3, dynamit: 1, winda: false, wozek: false, sklad: {} };
}

export function ileWPlecaku(s) { return Object.values(s.przedmioty).reduce((a, b) => a + b, 0); }
export function pojemnosc(s) { return PLECAKI[s.plecak].pojemnosc; }
export function czyPelny(s) { return ileWPlecaku(s) >= pojemnosc(s); }

// Czy obecny kilof ruszy ten blok?
export function mozeKopac(s, id) { const b = BLOCKS[id]; return !!b && !b.staly && s.kilof >= b.poziom; }
// Ile sekund trwa wykopanie bloku obecnym kilofem.
export function czasKopania(s, id) { return BLOCKS[id].twardosc / KILOFY[s.kilof].szybkosc; }

export function dodajUrobek(s, id) {
    if (!BLOCKS[id].wartosc || czyPelny(s)) return false;
    s.przedmioty[id] = (s.przedmioty[id] || 0) + 1;
    (s.odkryte ||= {})[id] = true;      // do atlasu surowców
    return true;
}
// ---------- Surowce: skład, przepisy, sprzedaż ----------
// Surowce leżą w plecaku albo w składzie na powierzchni (tam trafia
// urobek z wózka i to, co odłożone na ulepszenia).
export function ileSurowca(s, id) { return (s.przedmioty[id] || 0) + ((s.sklad || {})[id] || 0); }
// Przepis { klucz: ile } -> lista [id bloku, ile trzeba, ile mam].
export function skladniki(s, surowce) {
    return Object.entries(surowce || {}).map(([klucz, ile]) => [M[klucz], ile, ileSurowca(s, M[klucz])]);
}
export function starczaSurowcow(s, surowce) { return skladniki(s, surowce).every(([, trzeba, mam]) => mam >= trzeba); }
function zuzyj(s, surowce) {
    s.sklad ||= {};
    for (const [id, trzeba] of skladniki(s, surowce)) {
        const zeSkladu = Math.min(trzeba, s.sklad[id] || 0);
        if (zeSkladu) { s.sklad[id] -= zeSkladu; if (!s.sklad[id]) delete s.sklad[id]; }
        const zPlecaka = trzeba - zeSkladu;
        if (zPlecaka) { s.przedmioty[id] -= zPlecaka; if (!s.przedmioty[id]) delete s.przedmioty[id]; }
    }
}
// Ile czego potrzeba na następny kilof i następną lampę - tego skup
// nie sprzedaje przy "Sprzedaj wszystko".
export function rezerwa(s) {
    const out = {};
    for (const rodzaj of ['kilof', 'lampa']) {
        const n = nastepne(s, rodzaj);
        for (const [klucz, ile] of Object.entries(n?.surowce || {})) out[M[klucz]] = (out[M[klucz]] || 0) + ile;
    }
    return out;
}
// Co zostanie odłożone do składu przy sprzedaży: { id: ile }.
export function odlozone(s) {
    const out = {};
    for (const [id, trzeba] of Object.entries(rezerwa(s))) { const n = Math.min(trzeba, ileSurowca(s, id)); if (n) out[id] = n; }
    return out;
}
const wartosc = lista => Object.entries(lista || {}).reduce((a, [id, n]) => a + BLOCKS[id].wartosc * n, 0);
// Ile monet da "Sprzedaj wszystko": plecak i skład bez odłożonych surowców.
export function wartoscUrobku(s) { return wartosc(s.przedmioty) + wartosc(s.sklad) - wartosc(odlozone(s)); }
export function sprzedajWszystko(s) {
    const zysk = wartoscUrobku(s), zostaje = odlozone(s);
    s.kasa += zysk; s.przedmioty = {}; s.sklad = zostaje;
    return zysk;
}
// Sprzedaż także tego, co było odłożone na ulepszenia.
export function wartoscSkladu(s) { return wartosc(s.sklad); }
export function sprzedajSklad(s) {
    const zysk = wartosc(s.sklad);
    s.kasa += zysk; s.sklad = {};
    return zysk;
}
// Wózek: cały plecak jedzie na powierzchnię (zwraca liczbę sztuk).
export function wyslijUrobek(s) {
    let ile = 0;
    s.sklad ||= {};
    for (const [id, n] of Object.entries(s.przedmioty)) { s.sklad[id] = (s.sklad[id] || 0) + n; ile += n; }
    s.przedmioty = {};
    return ile;
}
export function kupUrzadzenie(s, rodzaj) {
    const u = URZADZENIA[rodzaj];
    if (!u || s[rodzaj] || s.kasa < u.cena) return false;
    s.kasa -= u.cena; s[rodzaj] = true;
    return true;
}

// Następny stopień ulepszenia (albo null, gdy to już najlepszy).
export function nastepne(s, rodzaj) { return LISTY[rodzaj][s[rodzaj] + 1] || null; }
export function kupUlepszenie(s, rodzaj) {
    const n = nastepne(s, rodzaj);
    if (!n || s.kasa < n.cena || !starczaSurowcow(s, n.surowce)) return false;
    s.kasa -= n.cena; zuzyj(s, n.surowce); s[rodzaj]++;
    if (rodzaj === 'lampa') s.paliwo = n.paliwo;      // nowa lampa jest pełna
    return true;
}
export function kupKopalnie(s, i) {
    const m = MINES[i];
    if (!m || s.kopalnie.includes(i) || s.kasa < m.cena) return false;
    s.kasa -= m.cena; s.kopalnie.push(i);
    return true;
}
export function kupZapas(s, rodzaj) {
    const z = ZAPASY[rodzaj];
    if (!z || s.kasa < z.cena) return false;
    s.kasa -= z.cena; s[rodzaj] = (s[rodzaj] || 0) + z.ile;
    return true;
}

// Lampa: ile paliwa zostało (0..1) i dolewanie do pełna na powierzchni.
export function poziomPaliwa(s) { return Math.max(0, Math.min(1, s.paliwo / LAMPY[s.lampa].paliwo)); }
export function napelnijLampe(s) { s.paliwo = LAMPY[s.lampa].paliwo; }

// Omdlenie w kopalni (zawał, brak powietrza): górnik gubi połowę
// każdego surowca (przy nieparzystej liczbie zostaje mu ta większa).
export function zgubPoloweUrobku(s) {
    let zgubione = 0;
    for (const id of Object.keys(s.przedmioty)) {
        const strata = Math.floor(s.przedmioty[id] / 2);
        s.przedmioty[id] -= strata; zgubione += strata;
        if (!s.przedmioty[id]) delete s.przedmioty[id];
    }
    return zgubione;
}
// Zapas zrobiony z własnych surowców zamiast kupiony za monety.
export function wytworzZapas(s, rodzaj) {
    const z = ZAPASY[rodzaj];
    if (!z?.przepis || !starczaSurowcow(s, z.przepis)) return false;
    zuzyj(s, z.przepis); s[rodzaj] = (s[rodzaj] || 0) + z.ile;
    return true;
}
