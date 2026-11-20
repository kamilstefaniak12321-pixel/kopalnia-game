// ------------------------------------------------------------
// KOPALNIE do odblokowania. Głębokości liczone od powierzchni w dół.
//   warstwy - od jakiej głębokości zaczyna się dana skała
//   rudy    - [blok, od, do, ile żył, wielkość żyły]
// ------------------------------------------------------------
import { STONE, SLATE, BASALT, COAL, COPPER, IRON, SILVER, GOLD, EMERALD, RUBY, DIAMOND } from './blocks.js';

export const MINES = [
    {
        nazwa: 'Stara Sztolnia', opis: 'Węgiel, miedź i żelazo. Dobra na początek.',
        cena: 0, depth: 54,
        warstwy: [{ od: 0, blok: STONE }, { od: 40, blok: SLATE }],
        rudy: [[COAL, 3, 40, 110, 9], [COPPER, 9, 46, 80, 7], [IRON, 20, 54, 60, 6], [SILVER, 42, 54, 20, 4]]
    },
    {
        nazwa: 'Srebrny Szyb', opis: 'Głębsza. Srebro, złoto i pierwsze szmaragdy.',
        cena: 1500, depth: 86,
        warstwy: [{ od: 0, blok: STONE }, { od: 18, blok: SLATE }, { od: 62, blok: BASALT }],
        rudy: [[COAL, 3, 20, 40, 8], [IRON, 6, 50, 90, 7], [SILVER, 20, 70, 80, 6], [GOLD, 36, 86, 60, 5], [EMERALD, 64, 86, 22, 3]]
    },
    {
        nazwa: 'Głębia Kryształów', opis: 'Najgłębsza. Rubiny i diamenty w bazalcie.',
        cena: 10000, depth: 118,
        warstwy: [{ od: 0, blok: STONE }, { od: 10, blok: SLATE }, { od: 40, blok: BASALT }],
        rudy: [[IRON, 4, 30, 50, 7], [GOLD, 12, 80, 100, 6], [EMERALD, 42, 100, 70, 4], [RUBY, 60, 118, 55, 4], [DIAMOND, 84, 118, 36, 3]]
    }
];
