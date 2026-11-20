# Plan rozwoju gry

## Kierunek

- **Bogata różnorodność surowców i minerałów** — to ma być jedna z
  głównych cech gry. Nie tylko kilka rud: wiele rodzajów skał, rud
  metali, kamieni szlachetnych i minerałów, z własnym wyglądem,
  głębokością, rzadkością i zastosowaniem. Każda kopalnia powinna mieć
  własny zestaw, żeby było po co odblokowywać kolejne.
- Bloki 64x64 px, gracz na 2 bloki, widok 3D z pierwszej osoby.

## Kolejność prac

1. **Kopalnia, która jest „twoja”** — zapis wykopanych bloków, stawianie
   drabin i pochodni. *(zrobione w 0.3.0)*
2. **Zagrożenia i napięcie** — zapas światła w lampie, zawały, woda.
   *(zrobione w 0.4.0; bez śmierci: wypadek = powrót na powierzchnię
   i strata połowy urobku)*
3. **Więcej do kupienia** — wózek, winda, dynamit, nowe kopalnie
   z własnym charakterem.
   *(zrobione w 0.5.0, razem ze stemplami)*
4. **Surowce i minerały** — duże rozszerzenie listy (patrz „Kierunek”),
   razem z tym, do czego służą.
   *(pierwsza duża porcja w 0.6.0: 31 surowców, 4 nowe skały,
   wytwarzanie sprzętu, atlas; listę można dalej rozszerzać w
   `src/minerals.js`)*

## Do zrobienia przy okazji

- Tekstury 64x64 od grafików zamiast zastępczych rysowanych kodem.
- Model postaci gracza.
- Samodzielne aktualizacje aplikacji na Androida.
- Klucz do podpisu właściwej aplikacji na Androida (`docs/aplikacje.md`).
