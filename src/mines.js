// ------------------------------------------------------------
// KOPALNIE do odblokowania. Głębokości liczone od powierzchni w dół.
//   warstwy - od jakiej głębokości zaczyna się dana skała
//   rudy    - [blok, od, do, ile żył, wielkość żyły]
//   charakter (nie trzeba podawać, domyślnie zwykła kopalnia):
//     woda   - ile razy więcej zbiorników wody
//     krucha - ile razy więcej kruchej skały
//     zalane - jaka część szybu od dołu stoi pod wodą (0..1)
//     mgla   - kolor ciemności pod ziemią
// Nowe kopalnie dopisuj NA KOŃCU listy (zapisy graczy pamiętają numery);
// w sklepie i tak są ułożone według ceny.
// ------------------------------------------------------------
import { STONE, SLATE, BASALT, M } from './blocks.js';

// [surowiec, od, do, ile żył, wielkość żyły]
const r = (klucz, od, doG, ile, rozmiar) => [M[klucz], od, doG, ile, rozmiar];

export const MINES = [
    {
        nazwa: 'Stara Sztolnia', opis: 'Węgiel, sól, krzemień, miedź z cyną, żelazo. Dobra na początek.',
        cena: 0, depth: 54,
        warstwy: [{ od: 0, blok: M.wapien }, { od: 7, blok: STONE }, { od: 40, blok: SLATE }],
        rudy: [r('wegiel', 3, 40, 90, 9), r('krzemien', 2, 16, 45, 5), r('sol', 4, 30, 40, 8), r('miedz', 9, 46, 70, 7),
            r('cyna', 10, 44, 50, 6), r('kwarc', 18, 50, 28, 4), r('zelazo', 20, 54, 60, 6), r('srebro', 42, 54, 20, 4)]
    },
    {
        nazwa: 'Srebrny Szyb', opis: 'Głębsza. Nikiel, srebro, złoto, ametysty, lazuryt i pierwsze szmaragdy.',
        cena: 1500, depth: 86,
        warstwy: [{ od: 0, blok: STONE }, { od: 8, blok: M.granit }, { od: 20, blok: SLATE }, { od: 62, blok: BASALT }],
        rudy: [r('wegiel', 3, 20, 35, 8), r('zelazo', 6, 50, 80, 7), r('nikiel', 8, 40, 60, 6), r('kwarc', 8, 30, 35, 4),
            r('srebro', 20, 70, 70, 6), r('lazuryt', 22, 62, 40, 6), r('kobalt', 26, 66, 36, 5), r('ametyst', 30, 70, 36, 4),
            r('zloto', 36, 86, 55, 5), r('szmaragd', 64, 86, 22, 3)]
    },
    {
        nazwa: 'Głębia Kryształów', opis: 'Najgłębsza. Szafiry, opale, rubiny, diamenty, tytan, platyna i iryd.',
        cena: 10000, depth: 118,
        warstwy: [{ od: 0, blok: M.granit }, { od: 10, blok: SLATE }, { od: 28, blok: M.marmur }, { od: 46, blok: BASALT }],
        rudy: [r('zelazo', 4, 28, 40, 7), r('topaz', 6, 30, 30, 4), r('zloto', 12, 80, 80, 6), r('opal', 28, 60, 40, 4),
            r('szmaragd', 42, 100, 55, 4), r('tytan', 46, 110, 50, 5), r('wolfram', 48, 100, 40, 5), r('szafir', 52, 110, 40, 4),
            r('platyna', 56, 118, 40, 5), r('rubin', 60, 118, 45, 4), r('aleksandryt', 30, 50, 12, 3), r('diament', 84, 118, 32, 3),
            r('iryd', 96, 118, 16, 3)]
    },
    {
        nazwa: 'Mokra Sztolnia', opis: 'Dolne poziomy stoją pod wodą. Siarka, saletra, ołów, cynk, malachit i bursztyn.',
        cena: 600, depth: 54,
        warstwy: [{ od: 0, blok: M.piaskowiec }, { od: 12, blok: STONE }, { od: 44, blok: SLATE }],
        rudy: [r('wegiel', 3, 30, 55, 8), r('siarka', 2, 14, 45, 7), r('bursztyn', 4, 14, 22, 3), r('saletra', 5, 14, 30, 6),
            r('miedz', 6, 54, 90, 8), r('olow', 12, 50, 55, 6), r('cynk', 16, 54, 55, 6), r('malachit', 24, 54, 40, 5),
            r('zelazo', 16, 54, 55, 6), r('srebro', 34, 54, 50, 5)],
        charakter: { woda: 2.5, krucha: 0.6, zalane: 0.38, mgla: 0x03080d }
    },
    {
        nazwa: 'Kruchy Uskok', opis: 'Stropy sypią się na głowę, ale jest złoto, topazy, jadeit, platyna i wolfram.',
        cena: 4000, depth: 86,
        warstwy: [{ od: 0, blok: M.piaskowiec }, { od: 6, blok: M.granit }, { od: 20, blok: SLATE }, { od: 66, blok: BASALT }],
        rudy: [r('saletra', 2, 8, 30, 6), r('zelazo', 5, 40, 55, 7), r('topaz', 8, 22, 36, 4), r('srebro', 20, 60, 55, 6),
            r('jadeit', 22, 64, 45, 5), r('zloto', 22, 86, 110, 6), r('szmaragd', 50, 86, 45, 4), r('wolfram', 66, 86, 40, 5),
            r('platyna', 68, 86, 30, 4)],
        charakter: { woda: 0.3, krucha: 4, zalane: 0, mgla: 0x0b0704 }
    }
];

const ZWYKLA = { woda: 1, krucha: 1, zalane: 0, mgla: 0x020203 };
export function charakter(def) { return { ...ZWYKLA, ...def.charakter }; }
