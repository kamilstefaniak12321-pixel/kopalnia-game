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
export const LAMPY = [
    { nazwa: 'Świeczka', zasieg: 7, cena: 0 },
    { nazwa: 'Lampa naftowa', zasieg: 11, cena: 120 },
    { nazwa: 'Lampa karbidowa', zasieg: 16, cena: 600 },
    { nazwa: 'Reflektor górniczy', zasieg: 24, cena: 2500 }
];
// Zapasy, które się zużywają: stawiane w kopalni drabiny i pochodnie.
export const ZAPASY = {
    drabiny: { nazwa: 'Drabiny', opis: 'Stawiane przy ścianie — droga w górę z każdej dziury.', ile: 5, cena: 15 },
    pochodnie: { nazwa: 'Pochodnie', opis: 'Stawiane na podłożu — światło, które zostaje w kopalni.', ile: 3, cena: 12 }
};
const LISTY = { kilof: KILOFY, plecak: PLECAKI, lampa: LAMPY };

export function nowyStan() {
    return { kasa: 0, kilof: 0, plecak: 0, lampa: 0, kopalnie: [0], kopalnia: 0, ziarno: 1, przedmioty: {}, drabiny: 8, pochodnie: 4 };
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
export function wartoscUrobku(s) {
    return Object.entries(s.przedmioty).reduce((a, [id, n]) => a + BLOCKS[id].wartosc * n, 0);
}
export function sprzedajWszystko(s) {
    const zysk = wartoscUrobku(s);
    s.kasa += zysk; s.przedmioty = {};
    return zysk;
}

// Następny stopień ulepszenia (albo null, gdy to już najlepszy).
export function nastepne(s, rodzaj) { return LISTY[rodzaj][s[rodzaj] + 1] || null; }
export function kupUlepszenie(s, rodzaj) {
    const n = nastepne(s, rodzaj);
    if (!n || s.kasa < n.cena) return false;
    s.kasa -= n.cena; s[rodzaj]++;
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
