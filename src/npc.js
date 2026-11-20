// ------------------------------------------------------------
// SKUPNIK BRONEK - postać w budce skupu. Zbudowany z pudełek w tych
// samych proporcjach co gracz (2 bloki wzrostu), z rękami zginanymi
// w łokciu. Animacje:
//   - oddech i lekkie kołysanie,
//   - mruganie,
//   - wodzenie głową za graczem,
//   - machanie na powitanie, gdy gracz podejdzie,
//   - praca (ogląda i poleruje bryłkę), gdy gracz jest daleko,
//   - radość (podskok z rękami w górze) po sprzedaży albo zleceniu,
//   - drapanie się po głowie co jakiś czas.
// Twarz to mała tekstura pikselowa (trzy miny: zwykła, mrugnięcie,
// uśmiech) - łatwo ją podmienić w funkcji twarz().
// ------------------------------------------------------------
import * as THREE from '../lib/three/three.module.js';

const PX = 1.8 / 32;      // jeden "piksel" postaci (postać ma 32 px wzrostu)
const SKORA = 0xd9a47a, KOSZULA = 0x4f6f8f, FARTUCH = 0x7a5230, SPODNIE = 0x3b3f52, KASK = 0xe9b62c;

function twarz(mina) {
    const c = document.createElement('canvas'); c.width = c.height = 8;
    const g = c.getContext('2d'), p = (x, y, w, h, kolor) => { g.fillStyle = kolor; g.fillRect(x, y, w, h); };
    p(0, 0, 8, 8, '#d9a47a');
    p(0, 0, 8, 1, '#5a3d28');                                   // włosy pod kaskiem
    if (mina === 'mrug') { p(1, 3, 2, 1, '#5a3d28'); p(5, 3, 2, 1, '#5a3d28'); }
    else if (mina === 'usmiech') { p(1, 2, 2, 1, '#2b2018'); p(5, 2, 2, 1, '#2b2018'); p(1, 3, 1, 1, '#2b2018'); p(2, 3, 1, 1, '#d9a47a'); p(6, 3, 1, 1, '#2b2018'); }
    else { p(1, 2, 2, 2, '#ffffff'); p(5, 2, 2, 2, '#ffffff'); p(2, 3, 1, 1, '#2b2018'); p(5, 3, 1, 1, '#2b2018'); }
    p(3, 4, 2, 1, '#c08a62');                                   // nos
    p(1, 5, 6, 1, '#6b4a30'); p(1, 6, 1, 1, '#6b4a30'); p(6, 6, 1, 1, '#6b4a30');   // wąsy
    if (mina === 'usmiech') p(2, 6, 4, 1, '#ffffff'); else p(3, 6, 2, 1, '#8a4a3a');
    const t = new THREE.CanvasTexture(c);
    t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

function pudelko(w, h, d, kolor, y = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w * PX, h * PX, d * PX), new THREE.MeshLambertMaterial({ color: kolor }));
    m.position.y = y * PX;
    return m;
}

export function createNpc() {
    const group = new THREE.Group();
    const cialo = new THREE.Group();                 // wszystko nad biodrami - kołysze się i podskakuje
    group.add(cialo);
    for (const s of [-1, 1]) { const noga = pudelko(4, 12, 4, SPODNIE, 6); noga.position.x = s * 2 * PX; group.add(noga); }
    cialo.position.y = 12 * PX;
    cialo.add(pudelko(8, 12, 4, KOSZULA, 6));
    const fartuch = pudelko(6.4, 9, 0.6, FARTUCH, 5); fartuch.position.z = 2.2 * PX; cialo.add(fartuch);

    const glowa = new THREE.Group(); glowa.position.y = 12 * PX; cialo.add(glowa);
    glowa.add(pudelko(8, 8, 8, SKORA, 4));
    const miny = { zwykla: twarz('zwykla'), mrug: twarz('mrug'), usmiech: twarz('usmiech') };
    const buzia = new THREE.Mesh(new THREE.PlaneGeometry(8 * PX, 8 * PX), new THREE.MeshLambertMaterial({ map: miny.zwykla }));
    buzia.position.set(0, 4 * PX, 4.03 * PX); glowa.add(buzia);
    glowa.add(pudelko(9, 2.6, 9, KASK, 8.4));
    const daszek = pudelko(9, 0.8, 2, KASK, 7.4); daszek.position.z = 5 * PX; glowa.add(daszek);
    const lampka = pudelko(2, 2, 1, 0xfff2b0, 8.6); lampka.position.z = 4.8 * PX; glowa.add(lampka);

    // Ręka: bark -> ramię -> łokieć -> przedramię.
    function reka(strona) {
        const bark = new THREE.Group(); bark.position.set(strona * 6 * PX, 11 * PX, 0);
        bark.add(pudelko(4, 6, 4, KOSZULA, -2));
        const lokiec = new THREE.Group(); lokiec.position.y = -5 * PX; bark.add(lokiec);
        lokiec.add(pudelko(3.8, 6, 3.8, SKORA, -3));
        cialo.add(bark);
        return { bark, lokiec };
    }
    const lewa = reka(-1), prawa = reka(1);
    // Bryłka, którą Bronek ogląda przy pracy.
    const brylka = pudelko(2.4, 2.4, 2.4, 0xf2c94c, -6.6); prawa.lokiec.add(brylka);

    let t = 0, akcja = 'praca', czasAkcji = 0, mrug = 2, blisko = false, doDrapania = 6, patrzY = 0, patrzX = 0;
    const cel = { lbx: 0, lbz: 0, llx: 0, pbx: 0, pbz: 0, plx: 0, skok: 0 };
    const stan = { ...cel };

    function zacznij(nowa, czas) { akcja = nowa; czasAkcji = czas; }

    return {
        group,
        get akcja() { return akcja; },
        // Wywoływane po udanej sprzedaży albo oddanym zleceniu.
        cheer() { zacznij('radosc', 1.4); },
        update(dt, gracz) {
            t += dt;
            const dx = gracz.x - group.position.x, dz = gracz.z - group.position.z, dy = gracz.y - group.position.y;
            const odl = Math.hypot(dx, dz), widzi = odl < 12 && Math.abs(dy) < 4;

            // Wybór akcji.
            if (czasAkcji > 0) { if ((czasAkcji -= dt) <= 0) akcja = 'stoi'; }
            if (widzi && odl < 6 && !blisko) { blisko = true; if (akcja !== 'radosc') zacznij('machanie', 2.2); }
            if (odl > 9) blisko = false;
            if (czasAkcji <= 0) {
                akcja = widzi && odl < 9 ? 'stoi' : 'praca';
                if (akcja === 'stoi' && (doDrapania -= dt) <= 0) { doDrapania = 7 + Math.random() * 8; zacznij('drapanie', 1.8); }
            }

            // Pozy: kąty barków (x - w przód, z - w bok) i łokci.
            cel.lbx = cel.pbx = Math.sin(t * 1.6) * 0.04; cel.lbz = cel.pbz = 0; cel.llx = cel.plx = -0.12; cel.skok = 0;
            if (akcja === 'praca') {                       // ogląda bryłkę, drugą ręką ją poleruje
                cel.pbx = -0.75; cel.plx = -1.25 + Math.sin(t * 0.9) * 0.12;
                cel.lbx = -0.7 + Math.sin(t * 7) * 0.12; cel.llx = -1.1; cel.lbz = 0.35;
            } else if (akcja === 'machanie') {
                cel.pbz = 2.5; cel.plx = 0; cel.pbx = Math.sin(t * 11) * 0.35;
            } else if (akcja === 'radosc') {
                cel.pbz = 2.7; cel.lbz = -2.7; cel.skok = Math.abs(Math.sin(t * 9)) * 0.16;
            } else if (akcja === 'drapanie') {
                cel.lbz = -2.45; cel.llx = -2.0 + Math.sin(t * 16) * 0.2;
            }
            const k = Math.min(1, dt * 9);
            for (const n in cel) stan[n] += (cel[n] - stan[n]) * k;
            lewa.bark.rotation.set(stan.lbx, 0, stan.lbz); lewa.lokiec.rotation.x = stan.llx;
            prawa.bark.rotation.set(stan.pbx, 0, stan.pbz); prawa.lokiec.rotation.x = stan.plx;
            brylka.visible = akcja === 'praca';

            // Oddech, kołysanie, podskok.
            cialo.position.y = 12 * PX + stan.skok;
            group.children[1].position.y = group.children[2].position.y = 6 * PX + stan.skok;   // nogi
            cialo.scale.y = 1 + Math.sin(t * 1.6) * 0.012;
            cialo.rotation.z = Math.sin(t * 0.7) * 0.015;

            // Głowa: za graczem, a przy pracy w dół na ręce.
            let ky = 0, kx = 0;
            if (akcja === 'praca') { kx = 0.45; ky = 0.25 + Math.sin(t * 0.5) * 0.1; }
            else if (widzi) {
                ky = Math.atan2(dx, dz) - group.rotation.y;
                ky = Math.atan2(Math.sin(ky), Math.cos(ky));
                ky = Math.max(-1.15, Math.min(1.15, ky));
                kx = Math.max(-0.45, Math.min(0.45, -Math.atan2(dy + 1.62 - 1.55, Math.max(0.5, odl))));
            }
            patrzY += (ky - patrzY) * Math.min(1, dt * 6); patrzX += (kx - patrzX) * Math.min(1, dt * 6);
            glowa.rotation.set(patrzX, patrzY, akcja === 'drapanie' ? 0.12 : 0);

            // Mina i mruganie.
            mrug -= dt;
            if (mrug < -0.12) mrug = 2 + Math.random() * 3.5;
            buzia.material.map = akcja === 'radosc' || akcja === 'machanie' ? miny.usmiech : mrug < 0 ? miny.mrug : miny.zwykla;
        }
    };
}

// Co Bronek mówi w oknie skupu - zależnie od tego, co się właśnie stało.
const KWESTIE = {
    powitanie: ['Szczęść Boże! Co tam słychać na dole?', 'No, pokaż, co wykopałeś.', 'O, żyjesz. To dobrze, bo mam zlecenia.', 'Kilof cały? Plecy całe? No to do roboty.'],
    pusto: ['Pusty plecak? Kopalnia sama się nie wykopie.', 'Z pustego to i ja nie naleję.'],
    sprzedaz: ['Uczciwa cena, jak zawsze. Prawie.', 'Dobry urobek. Przynoś więcej.', 'Z takim towarem to rozumiem.'],
    zlecenie: ['No i to rozumiem! Trzymaj, zasłużyłeś.', 'Klient będzie zadowolony. Ja już jestem.', 'Na ciebie zawsze można liczyć.'],
    wypadek: ['Ratownicy znowu cię wynieśli? Ja im za to nie płacę.', 'Podobno coś ci spadło na głowę. Kask masz od parady?'],
    zakup: ['Dobry wybór. Tylko nie zgub w pierwszym zawale.', 'Zadbaj o sprzęt, a sprzęt zadba o ciebie.']
};
export function kwestia(okazja) {
    const lista = KWESTIE[okazja] || KWESTIE.powitanie;
    return lista[Math.floor(Math.random() * lista.length)];
}
