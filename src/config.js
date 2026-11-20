// ------------------------------------------------------------
// USTAWIENIA GRY - liczby, które łatwo zmienić w jednym miejscu.
// ------------------------------------------------------------

// Rozmiar kopalni w poziomie (bloki). Wysokość zależy od kopalni.
export const WORLD_X = 64;
export const WORLD_Z = 64;

// Ile warstw powietrza jest nad ziemią (miejsce na powierzchnię).
export const SURFACE_AIR = 10;

// Świat jest rysowany kawałkami 16x16x16 bloków.
export const CHUNK = 16;

// Tekstura jednego bloku: 64x64 piksele. Atlas mieści 8x8 tekstur.
export const TILE = 64;
export const ATLAS_TILES = 8;

// Gracz: te same proporcje co w Various Roots - mieści się w 2 blokach.
export const PLAYER_WIDTH = 0.6;
export const PLAYER_HEIGHT = 1.8;
export const EYE_HEIGHT = 1.62;

export const WALK_SPEED = 4.3;
export const SPRINT_SPEED = 5.8;
export const JUMP_SPEED = 8.2;
export const GRAVITY = 26;
export const LADDER_SPEED = 3.4;

// Jak daleko sięga kilof (bloki).
export const REACH = 4.5;

export const SAVE_KEY = 'kopalnia-game-zapis-1';
export const VERSION = '0.2.0';
