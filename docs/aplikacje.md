# Aplikacje: Windows i Android

W środku to ta sama gra co w przeglądarce (`index.html`, `src/`, `lib/`).
Na komputerze opakowuje ją Electron, na telefonie Capacitor.

## Dla gracza

Wszystkie pliki są w wydaniach:
<https://github.com/kamilstefaniak12321-pixel/kopalnia-game/releases/latest>

**Windows:** pobierz `Kopalnia-<wersja>-instalator.exe` i uruchom. Wybierz
instalację *tylko dla mnie*. Windows może pokazać „System Windows ochronił
ten komputer” (aplikacja nie ma płatnego podpisu): *Więcej informacji* →
*Uruchom mimo to*. Zainstalowana gra sama pobiera nowe wersje i instaluje
je po zamknięciu. Zapis jest w `%APPDATA%\Kopalnia`. F11 - pełny ekran,
F12 - konsola błędów.

**Android:** pobierz na telefonie plik `.apk` z wydania i otwórz go
(telefon zapyta o zgodę na instalację z tego źródła). Nową wersję
instaluje się tak samo - na starą, postęp zostaje. Aplikacja nie
aktualizuje się jeszcze sama.

## Jak powstaje nowa wersja

1. Podnieś `"version"` w `package.json` (i w `package-lock.json`,
   `src/config.js`), dopisz sekcję w `CHANGELOG.md`. `npm test` pilnuje,
   żeby te miejsca się zgadzały.
2. Zmiana trafia na `main`.
3. GitHub Actions (`.github/workflows/aplikacje.yml`) buduje instalator
   i `.apk` i publikuje wydanie `v<wersja>`. Trwa to kilka minut - widać
   w zakładce **Actions**. Scalenie bez zmiany wersji niczego nie wydaje.

## Klucz do podpisu aplikacji na Androida

Bez klucza powstaje wersja testowa **Kopalnia (test)**
(`...-android-TEST.apk`), podpisana jawnym kluczem z gita
(`android/app/klucz-testowy.keystore`). Do grania wystarcza, ale każdy
mógłby tym kluczem podpisać podróbkę aktualizacji.

Żeby wydawać właściwą aplikację **Kopalnia**, dodaj w repozytorium
(*Settings → Secrets and variables → Actions*) dwa sekrety:

| Sekret | Co to |
| --- | --- |
| `ANDROID_KEYSTORE` | plik klucza `.p12` zapisany jako tekst base64 |
| `ANDROID_KEYSTORE_PASSWORD` | hasło do klucza |

Nowy klucz (alias musi być `kopalnia`):
`keytool -genkeypair -storetype PKCS12 -keystore kopalnia.p12 -alias kopalnia -keyalg RSA -keysize 4096 -validity 36500`.
Trzymaj kopię klucza prywatnie - bez niej nie da się wydać aktualizacji
instalującej się na poprzednią wersję. Właściwa aplikacja i wersja
testowa to dwie osobne aplikacje z osobnym postępem.

## Uruchamianie ze źródeł

    npm install        biblioteki (Electron, Capacitor)
    npm start          gra w oknie aplikacji
    npm run dist       instalator do folderu dist/ (na Windowsie)
    npm run android:sync   pliki gry do projektu android/

Ikonki: `node tools/ikona.mjs`, potem `python tools/android_ikony.py`.
