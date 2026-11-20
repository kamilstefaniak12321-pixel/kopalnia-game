# Zmiany

## 0.7.0

- Zlecenia w skupie: do trzech zamówień na konkretne surowce z kupionych
  kopalni, z nagrodą ponad dwa razy wyższą od zwykłej ceny. Niewygodne
  zlecenie można wymienić za 10 monet. Skup nie sprzedaje surowców
  potrzebnych na zlecenia.
- Skupnik Bronek stoi w budce: oddycha, mruga, wodzi głową za graczem,
  macha na powitanie, ogląda bryłkę, gdy nikogo nie ma, cieszy się po
  sprzedaży i zleceniu, czasem drapie się po głowie. W oknie skupu
  komentuje to, co się właśnie stało.
- Nad powierzchnią płyną chmury.

## 0.6.0

- 31 surowców zamiast 8: metale (cyna, ołów, cynk, nikiel, kobalt,
  wolfram, tytan, platyna, iryd...), kamienie szlachetne (bursztyn,
  ametyst, jadeit, topaz, opal, szafir, aleksandryt...) i minerały (sól,
  krzemień, siarka, kwarc, saletra, malachit, lazuryt).
- Surowce wyglądają różnie w skale: bryłki, graniaste kryształy, żyły,
  ziarna, faliste warstwy, mieniący się opal.
- Cztery nowe skały: wapień, piaskowiec, granit, marmur. Każda kopalnia
  ma własne warstwy skał i własny zestaw surowców.
- Wytwarzanie: kilofy i lampy wymagają oprócz monet konkretnych surowców
  (np. miedziany kilof: miedź i cyna). Dynamit można zrobić z saletry,
  siarki i węgla.
- Skład na powierzchni: skup sam odkłada surowce potrzebne na następny
  kilof i lampę; resztę sprzedaje.
- Atlas surowców w sklepie: co już odkryte, ile warte, jakim kilofem
  i w której kopalni.
- Wszystkie surowce są w jednej tabeli: `src/minerals.js`.

## 0.5.0

- Stemple: postawione pod kruchym stropem podpierają go (można je
  stawiać jeden na drugim).
- Dynamit: po 3,5 s wysadza każdą skałę w promieniu 2 bloków, także
  taką, której kilof jeszcze nie rusza. Rudy, które kilof ruszy, trafiają
  do plecaka; twardsze zostają w ścianie. Wybuch zrywa kruche stropy
  i powala górnika, który stoi za blisko.
- Wózek: przy szybie wysyła cały plecak na powierzchnię; urobek czeka
  w skupie i nie przepada przy wypadku.
- Winda: przy szybie przewozi na wybrany poziom i z powrotem.
- Dwie nowe kopalnie z własnym charakterem: Mokra Sztolnia (zalane
  dolne poziomy, dużo miedzi i srebra) i Kruchy Uskok (dużo złota
  i szmaragdów, bardzo kruche stropy).
- Pasek wyboru ma 5 pól (klawisze 1-5).

## 0.4.0

- Lampa ma zapas paliwa: pod ziemią go ubywa, na powierzchni dolewa się
  sam. Pusta lampa ledwo się tli - wtedy ratują pochodnie. Lepsze lampy
  świecą dłużej.
- Zawały: w stropach chodników trafia się krucha, spękana skała. Kopanie
  w pobliżu (2 bloki) zrywa ją i pociąga sąsiednie bloki; zostaje rumosz.
- Woda: w skale są zamknięte zbiorniki. Po przebiciu się woda przelewa
  się do niższych chodników. W wodzie chodzi się wolniej i można pływać,
  a pod wodą kończy się powietrze.
- W grze się nie ginie: po zawale albo braku powietrza ratownicy wynoszą
  górnika na powierzchnię, ale połowa urobku zostaje w kopalni.

## 0.3.0

- Kopalnia pamięta, co w niej zrobisz: wykopane bloki zostają po
  ponownym uruchomieniu gry (do wylosowania nowej wyprawy).
- Drabiny do stawiania przy ścianach - można wyjść z każdej dziury.
- Pochodnie do stawiania na podłożu - ich światło rozlewa się po
  korytarzach i zostaje w kopalni.
- Pasek wyboru (kilof, drabina, pochodnia): klawisze 1-3, kółko myszy
  albo dotknięcie; zapasy dokupuje się w sklepie.
- Wykopanie ściany pod drabiną albo podłoża pod pochodnią oddaje je.
- `docs/plan.md` - plan rozwoju gry.

## 0.2.0

- Aplikacja na Windowsa z instalatorem (skrót na pulpicie, własne okno,
  automatyczne aktualizacje z wydań na GitHubie).
- Aplikacja na Androida (.apk): gra na cały ekran, zawsze poziomo.
- Sterowanie dotykowe: gałka do chodzenia, przeciąganie po ekranie do
  rozglądania, przyciski kopania, skoku, schodzenia, sklepu i liny.
- Menu i sklep mieszczą się na małym ekranie telefonu.
- Postęp zapisuje się też przy schowaniu aplikacji.

## 0.1.0

- Pierwsza grywalna wersja: bloki 64x64, gracz na 2 bloki, proceduralna
  kopalnia (szyb z drabiną, chodniki, komory, żyły rud), kopanie kilofem,
  skup i sklep, trzy kopalnie, zapis postępu, komendy testowe.
