# Kopalnia (nazwa robocza)

Gra 3D o górniku: schodzisz do proceduralnie generowanej kopalni, wykopujesz
surowce, sprzedajesz je na powierzchni i kupujesz lepszy sprzęt oraz nowe kopalnie.

- Bloki mają tekstury **64x64 piksele**, gracz ma wysokość **2 bloków**
  (te same proporcje co w Various Roots).
- Silnik: three.js, bez kroku budowania — wystarczy przeglądarka.

## Jak uruchomić

Gra używa modułów, więc potrzebuje małego serwera (samo kliknięcie w `index.html` nie wystarczy):

    python -m http.server 8080

i w przeglądarce: http://localhost:8080

## Sterowanie

| Klawisz | Działanie |
| --- | --- |
| W A S D, mysz | ruch i rozglądanie |
| Lewy przycisk myszy | kopanie |
| Spacja / Shift | skok; na drabinie w górę / w dół |
| Ctrl | bieg |
| E | skup i sklep (przy budce na powierzchni) |
| R (przytrzymaj) | lina ratunkowa na powierzchnię |
| T | komendy testowe: `kasa N`, `kilof 0-5`, `plecak 0-3`, `lampa 0-3`, `kopalnia 0-2`, `gora`, `dol`, `reset` |

## Co gdzie leży

| Plik | Co robi |
| --- | --- |
| `src/config.js` | liczby: rozmiar świata, gracz, prędkości |
| `src/blocks.js` | bloki: twardość, wymagany kilof, wartość |
| `src/mines.js` | lista kopalni: głębokość, warstwy skał, rudy, cena |
| `src/mine.js` | generator kopalni (szyb, chodniki, komory, żyły) |
| `src/economy.js` | kilofy, plecaki, lampy, sprzedaż i zakupy |
| `src/textures.js` | zastępcze tekstury 64x64 rysowane kodem |
| `src/mesher.js` | zamiana bloków na trójkąty |
| `src/player.js` | ruch gracza, zderzenia, drabina |
| `src/main.js` | pętla gry, kopanie, HUD, sklep |
| `tools/sprawdz.mjs` | sprawdzenia logiki: `npm test` |

Postęp (monety, sprzęt, kopalnie, urobek) zapisuje się w przeglądarce.
Wykopane bloki nie są zapisywane — po ponownym wejściu kopalnia jest znów cała.
