// ------------------------------------------------------------
// OSIĄGNIĘCIA. Każde ma nazwę, komentarz i rzadkość.
//   test(stan) - osiągnięcia, które widać w samym stanie gry (monety,
//                atlas, zlecenia...); sprawdzane po każdej zmianie.
//   bez testu  - przyznawane przez grę w chwili zdarzenia (zawał,
//                wybuch, zejście na dno...), przez zdobadz(id).
// Nowe osiągnięcie = nowy wiersz; kolejność na liście to kolejność w księdze.
// ------------------------------------------------------------
import { MINERALY } from './minerals.js';
import { MINES } from './mines.js';
import { ZNALEZISKA } from './finds.js';

export const RZADKOSCI = { zwykle: 'Zwykłe', rzadkie: 'Rzadkie', epickie: 'Epickie', legendarne: 'Legendarne' };
const odkryte = s => Object.keys(s.odkryte || {}).length;

export const OSIAGNIECIA = [
    { id: 'brylka', rzadkosc: 'zwykle', nazwa: 'Pierwsza bryłka', opis: 'Od czegoś trzeba zacząć.', test: s => odkryte(s) >= 1 },
    { id: 'grosz', rzadkosc: 'zwykle', nazwa: 'Pierwszy grosz', opis: 'Bronek zapłacił. Przelicz, tak na wszelki wypadek.' },
    { id: 'drabina', rzadkosc: 'zwykle', nazwa: 'Szczebel po szczeblu', opis: 'Kto stawia drabiny, ten wraca na obiad.' },
    { id: 'swiatlo', rzadkosc: 'zwykle', nazwa: 'Niech stanie się światło', opis: 'Pochodnia postawiona. Ciemność obrażona.' },
    { id: 'stempel', rzadkosc: 'zwykle', nazwa: 'Na wszelki wypadek', opis: 'Strop podparty. Sumienie też.' },
    { id: 'kilof', rzadkosc: 'zwykle', nazwa: 'Lepszy kilof', opis: 'Stary idzie na ścianę. Albo do pieca.', test: s => s.kilof >= 1 },
    { id: 'dno', rzadkosc: 'rzadkie', nazwa: 'Na samym dnie', opis: 'Niżej się nie da. Chyba że z dynamitem.' },
    { id: 'zawal', rzadkosc: 'rzadkie', nazwa: 'Kask się przydał', opis: 'Ratownicy znają już twoje imię.' },
    { id: 'nurek', rzadkosc: 'rzadkie', nazwa: 'Nurek amator', opis: 'Górnicy oddychają powietrzem. Zapamiętaj.' },
    { id: 'hydraulik', rzadkosc: 'rzadkie', nazwa: 'Hydraulik', opis: 'Przebiłeś się do zbiornika. Kran był gdzie indziej.' },
    { id: 'ciemnosc', rzadkosc: 'rzadkie', nazwa: 'Egipskie ciemności', opis: 'Lampa zgasła pod ziemią. Widzisz? No właśnie.' },
    { id: 'saper', rzadkosc: 'rzadkie', nazwa: 'Saper myli się raz', opis: 'Ty najwyraźniej możesz częściej.' },
    { id: 'zlecenie', rzadkosc: 'rzadkie', nazwa: 'Solidna firma', opis: 'Pierwsze zlecenie oddane w terminie. Terminu nie było, ale i tak.', test: s => (s.wykonaneZlecenia || 0) >= 1 },
    { id: 'hutnik', rzadkosc: 'rzadkie', nazwa: 'Hutnik', opis: 'Pierwszy stop z pieca. Brwi odrosną.', test: s => (s.wytopione || 0) >= 1 },
    { id: 'grzybiarz', rzadkosc: 'rzadkie', nazwa: 'Grzybiarz', opis: 'Świeci, więc pewnie niejadalny. Słusznie nie sprawdzasz.' },
    { id: 'nietoperze', rzadkosc: 'zwykle', nazwa: 'Kto tu świeci?', opis: 'Spłoszyłeś nietoperze. One ciebie też.' },
    { id: 'znalazca', rzadkosc: 'rzadkie', nazwa: 'Znalazca', opis: 'Pierwszy okaz w gablotce. Bronek już go odkurza.', test: s => Object.keys(s.gablotka || {}).length >= 1 },
    { id: 'geoda', rzadkosc: 'rzadkie', nazwa: 'Co jest w środku?', opis: 'Rozbiłeś geodę. Teraz chcesz następną.', test: s => (s.rozbiteGeody || 0) >= 1 },
    { id: 'lancuch', rzadkosc: 'epickie', nazwa: 'Reakcja łańcuchowa', opis: 'Jeden ładunek odpalił drugi. Bronek słyszał to w budce.' },
    { id: 'prawa_reka', rzadkosc: 'epickie', nazwa: 'Prawa ręka Bronka', opis: 'Dziesięć zleceń. Bronek prawie się uśmiechnął.', test: s => (s.wykonaneZlecenia || 0) >= 10 },
    { id: 'kolekcjoner', rzadkosc: 'epickie', nazwa: 'Kolekcjoner', opis: 'Piętnaście surowców w atlasie. Półki się uginają.', test: s => odkryte(s) >= 15 },
    { id: 'ryba', rzadkosc: 'epickie', nazwa: 'Gruba ryba', opis: '5000 monet naraz. Nie wydaj wszystkiego na dynamit.', test: s => s.kasa >= 5000 },
    { id: 'diament', rzadkosc: 'epickie', nazwa: 'Diamenty są wieczne', opis: 'Pierwszy diament. Plecak nagle jakby lżejszy.', test: s => !!(s.odkryte || {})[16] },
    { id: 'magnat', rzadkosc: 'legendarne', nazwa: 'Magnat górniczy', opis: 'Wszystkie kopalnie są twoje. Podatki też.', test: s => s.kopalnie.length >= MINES.length },
    { id: 'kilof_ostateczny', rzadkosc: 'legendarne', nazwa: 'Kilof ostateczny', opis: 'Diamentowy kilof. Skała już się boi.', test: s => s.kilof >= 5 },
    { id: 'muzeum', rzadkosc: 'legendarne', nazwa: 'Dyrektor muzeum', opis: 'Gablotka pełna. Bronek chce sprzedawać bilety.', test: s => Object.keys(s.gablotka || {}).length >= ZNALEZISKA.length },
    { id: 'atlas', rzadkosc: 'legendarne', nazwa: 'Chodzący atlas', opis: 'Każdy surowiec odkryty. Geolodzy proszą o autograf.', test: s => odkryte(s) >= MINERALY.length }
];

// Które osiągnięcia "ze stanu" właśnie zostały spełnione (i zapisuje je).
export function sprawdzOsiagniecia(s) {
    s.osiagniecia ||= {};
    const nowe = [];
    for (const o of OSIAGNIECIA) if (o.test && !s.osiagniecia[o.id] && o.test(s)) { s.osiagniecia[o.id] = true; nowe.push(o); }
    return nowe;
}
// Przyznanie osiągnięcia za zdarzenie; zwraca je, jeśli jest nowe.
export function przyznaj(s, id) {
    s.osiagniecia ||= {};
    const o = OSIAGNIECIA.find(x => x.id === id);
    if (!o || s.osiagniecia[id]) return null;
    s.osiagniecia[id] = true;
    return o;
}
