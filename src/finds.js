// ------------------------------------------------------------
// ZNALEZISKA - rzadkie rzeczy ukryte w kopalni. Trafiają do gablotki
// w skupie; za pierwszy okaz Bronek płaci pełną nagrodę, za każdy
// kolejny ćwierć.
//   skamieniałość - wykop blok ze spiralą amonitu,
//   stare         - stara skrzynka na dnie komory (plus trochę zapasów),
//   kryształ      - bywa w środku geody (geodę rozbija się w skupie).
// "waga" - im większa, tym częściej trafia się ten okaz.
// Czysta logika.
// ------------------------------------------------------------
import { BLOCKS } from './blocks.js';
import { MINERALY } from './minerals.js';

export const GRUPY = { skamienialosc: 'Skamieniałości', stare: 'Po dawnych górnikach', krysztal: 'Kryształy z geod' };

export const ZNALEZISKA = [
    { id: 'amonit', grupa: 'skamienialosc', waga: 10, nagroda: 40, nazwa: 'Amonit', opis: 'Ślimak sprzed milionów lat. Wolniejszy już nie będzie.' },
    { id: 'trylobit', grupa: 'skamienialosc', waga: 9, nagroda: 50, nazwa: 'Trylobit', opis: 'Wygląda jak stonoga w zbroi. Bronek mówi, że to kuzyn.' },
    { id: 'paproc', grupa: 'skamienialosc', waga: 9, nagroda: 45, nazwa: 'Odcisk paproci', opis: 'Kiedyś był tu las. Z niego jest twój węgiel.' },
    { id: 'muszla', grupa: 'skamienialosc', waga: 8, nagroda: 45, nazwa: 'Skamieniała muszla', opis: 'Morze w kopalni. Na szczęście dawno wyschło.' },
    { id: 'zab_rekina', grupa: 'skamienialosc', waga: 5, nagroda: 90, nazwa: 'Ząb rekina', opis: 'Właściciel po niego nie wróci.' },
    { id: 'kosc_mamuta', grupa: 'skamienialosc', waga: 2, nagroda: 260, nazwa: 'Kość mamuta', opis: 'Ledwo weszła do plecaka. Resztę mamuta zostaw.' },
    { id: 'jajo', grupa: 'skamienialosc', waga: 1, nagroda: 600, nazwa: 'Jajo dinozaura', opis: 'Nie wysiaduj. Naprawdę.' },
    { id: 'stary_kilof', grupa: 'stare', waga: 10, nagroda: 35, nazwa: 'Zardzewiały kilof', opis: 'Ktoś tu kopał przed tobą. I chyba mu się znudziło.' },
    { id: 'lampa_gornicza', grupa: 'stare', waga: 8, nagroda: 60, nazwa: 'Stara lampa górnicza', opis: 'Nie świeci, ale ładnie wygląda na półce.' },
    { id: 'manierka', grupa: 'stare', waga: 8, nagroda: 40, nazwa: 'Manierka', opis: 'Pusta. Sprawdzałeś dwa razy.' },
    { id: 'helm', grupa: 'stare', waga: 6, nagroda: 70, nazwa: 'Skórzany hełm', opis: 'Z wgnieceniem. Lepiej nie pytać skąd.' },
    { id: 'moneta', grupa: 'stare', waga: 4, nagroda: 150, nazwa: 'Srebrna moneta', opis: 'Starsza niż Bronek. Podobno.' },
    { id: 'mapa', grupa: 'stare', waga: 1, nagroda: 450, nazwa: 'Mapa sztolni', opis: 'Kopalnia się zmieniła, mapa nie. Do gablotki w sam raz.' },
    { id: 'krysztal_gorski', grupa: 'krysztal', waga: 10, nagroda: 80, nazwa: 'Kryształ górski', opis: 'Przezroczysty jak sumienie Bronka. Prawie.' },
    { id: 'agat', grupa: 'krysztal', waga: 7, nagroda: 120, nazwa: 'Agat', opis: 'Kolorowe słoje jak w drzewie, tylko twardsze.' },
    { id: 'druza', grupa: 'krysztal', waga: 3, nagroda: 320, nazwa: 'Druza ametystu', opis: 'Mała jaskinia pełna fioletu. Mieści się w dłoni.' }
];

// Losuje okaz z grupy, dopisuje do gablotki i wypłaca nagrodę.
export function znajdz(s, grupa, rnd = Math.random) {
    const pula = ZNALEZISKA.filter(z => z.grupa === grupa);
    let los = rnd() * pula.reduce((a, z) => a + z.waga, 0), okaz = pula[pula.length - 1];
    for (const z of pula) { if ((los -= z.waga) < 0) { okaz = z; break; } }
    s.gablotka ||= {};
    const nowe = !s.gablotka[okaz.id];
    s.gablotka[okaz.id] = (s.gablotka[okaz.id] || 0) + 1;
    const monety = nowe ? okaz.nagroda : Math.round(okaz.nagroda / 4);
    s.kasa += monety;
    return { okaz, nowe, monety };
}

// Stara skrzynka: okaz po dawnych górnikach i garść zapasów.
export function otworzSkrzynke(s, rnd = Math.random) {
    const wynik = znajdz(s, 'stare', rnd);
    const [zapas, ile] = [['drabiny', 3], ['pochodnie', 3], ['stemple', 2], ['dynamit', 1]][Math.floor(rnd() * 4)];
    s[zapas] = (s[zapas] || 0) + ile;
    return { ...wynik, zapas, ile };
}

// Rozbicie geody w skupie: 2-4 sztuki klejnotów albo minerałów z listy
// kopalni (takich, które ruszyłby kilof o stopień lepszy od obecnego),
// czasem także kryształ do gablotki. Surowce trafiają do składu.
export function rozbijGeode(s, GEODE, rudyKopalni, rnd = Math.random) {
    if (!((s.przedmioty[GEODE] || 0) + ((s.sklad || {})[GEODE] || 0))) return null;
    if (s.przedmioty[GEODE]) { if (!--s.przedmioty[GEODE]) delete s.przedmioty[GEODE]; }
    else if (!--s.sklad[GEODE]) delete s.sklad[GEODE];
    let pula = MINERALY.filter(m => m.rodzaj !== 'paliwo' && m.poziom <= s.kilof + 1 && rudyKopalni.some(r => r[0] === m.id));
    const cenne = pula.filter(m => m.rodzaj === 'klejnot' || m.rodzaj === 'mineral');
    if (cenne.length) pula = cenne;
    const zawartosc = {};
    s.sklad ||= {}; s.odkryte ||= {};
    if (pula.length) for (let i = 0, n = 2 + Math.floor(rnd() * 3); i < n; i++) {
        const m = pula[Math.floor(rnd() * pula.length)];
        zawartosc[m.id] = (zawartosc[m.id] || 0) + 1;
        s.sklad[m.id] = (s.sklad[m.id] || 0) + 1; s.odkryte[m.id] = true;
    }
    s.rozbiteGeody = (s.rozbiteGeody || 0) + 1;
    const krysztal = rnd() < 0.3 ? znajdz(s, 'krysztal', rnd) : null;
    return { zawartosc, krysztal, wartosc: Object.entries(zawartosc).reduce((a, [id, n]) => a + BLOCKS[id].wartosc * n, 0) };
}
