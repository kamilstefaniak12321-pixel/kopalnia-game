// ------------------------------------------------------------
// GOSPODARKA: urobek w plecaku, sprzedaż, ulepszenia, kopalnie.
// Czysta logika na zwykłym obiekcie stanu (łatwo zapisać i sprawdzić).
// ------------------------------------------------------------
import { BLOCKS } from './blocks.js';
import { MINES } from './mines.js';

export const KILOFY = [
    { nazwa: 'Drewniany kilof', szybkosc: 1.0, cena: 0, kolor: 0x9a6b3a },
    { nazwa: 'Kamienny kilof', szybkosc: 1.5, cena: 60, kolor: 0x8c8c92 },
    { nazwa: 'Miedziany kilof', szybkosc: 2.2, cena: 250, kolor: 0xd6783e },
    { nazwa: 'Żelazny kilof', szybkosc: 3.2, cena: 900, kolor: 0xcfd3d8 },
    { nazwa: 'Stalowy kilof', szybkosc: 4.6, cena: 3000, kolor: 0x6f8296 },
    { nazwa: 'Diamentowy kilof', szybkosc: 7.0, cena: 12000, kolor: 0x6eecf6 }
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
    { nazwa: 'Lampa naftowa', zasieg: 11, cena: 120, paliwo: 360 },
    { nazwa: 'Lampa karbidowa', zasieg: 16, cena: 600, paliwo: 540 },
    { nazwa: 'Reflektor górniczy', zasieg: 24, cena: 2500, paliwo: 900 }
];
// Zapasy, które się zużywają: stawiane w kopalni drabiny i pochodnie.
export const ZAPASY = {
    drabiny: { nazwa: 'Drabiny', opis: 'Stawiane przy ścianie — droga w górę z każdej dziury.', ile: 5, cena: 15 },
    pochodnie: { nazwa: 'Pochodnie', opis: 'Stawiane na podłożu — światło, które zostaje w kopalni.', ile: 3, cena: 12 },
    stemple: { nazwa: 'Stemple', opis: 'Stawiane pod kruchym stropem — podparta skała nie spadnie.', ile: 4, cena: 20 },
    dynamit: { nazwa: 'Dynamit', opis: 'Wysadza każdą skałę w promieniu 2 bloków. Odejdź, zanim wybuchnie!', ile: 2, cena: 50 }
};
// Urządzenia szybu: kupowane raz, działają we wszystkich kopalniach.
export const URZADZENIA = {
    wozek: { nazwa: 'Wózek', opis: 'Przy szybie wyślesz urobek na powierzchnię i kopiesz dalej z pustym plecakiem.', cena: 400 },
    winda: { nazwa: 'Winda', opis: 'Przy szybie zjedziesz od razu na wybrany poziom i wrócisz na górę.', cena: 800 }
};
const LISTY = { kilof: KILOFY, plecak: PLECAKI, lampa: LAMPY };

export function nowyStan() {
    return { kasa: 0, kilof: 0, plecak: 0, lampa: 0, kopalnie: [0], kopalnia: 0, ziarno: 1, przedmioty: {}, drabiny: 8, pochodnie: 4, paliwo: LAMPY[0].paliwo,
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
    return true;
}
const wartosc = lista => Object.entries(lista || {}).reduce((a, [id, n]) => a + BLOCKS[id].wartosc * n, 0);
// Do sprzedania: to, co w plecaku, i to, co wózek wywiózł na górę.
export function wartoscUrobku(s) { return wartosc(s.przedmioty) + wartosc(s.sklad); }
export function sprzedajWszystko(s) {
    const zysk = wartoscUrobku(s);
    s.kasa += zysk; s.przedmioty = {}; s.sklad = {};
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
    if (!n || s.kasa < n.cena) return false;
    s.kasa -= n.cena; s[rodzaj]++;
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
