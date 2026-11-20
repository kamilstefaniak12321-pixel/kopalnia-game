# Ikonki aplikacji na Androida z desktop/icon.png.
# Uruchomienie w folderze gry (potrzebny Python z Pillow):
#     python tools/android_ikony.py
import os
from PIL import Image, ImageDraw

RES = 'android/app/src/main/res'
TLO = (29, 24, 20, 255)
DENSITIES = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
icon = Image.open('desktop/icon.png').convert('RGBA')

for name, k in DENSITIES.items():
    folder = f'{RES}/mipmap-{name}'
    os.makedirs(folder, exist_ok=True)
    # Zwykła ikonka (starsze telefony): blok na ciemnym tle, kwadrat i koło.
    size = round(48 * k)
    square = Image.new('RGBA', (size, size), TLO)
    inner = icon.resize((round(size * 0.78),) * 2, Image.NEAREST)
    square.paste(inner, ((size - inner.width) // 2,) * 2)
    square.save(f'{folder}/ic_launcher.png')
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    inner = icon.resize((round(size * 0.6),) * 2, Image.NEAREST)
    circle = Image.new('RGBA', (size, size), TLO)
    circle.paste(inner, ((size - inner.width) // 2,) * 2)
    circle.putalpha(mask)
    circle.save(f'{folder}/ic_launcher_round.png')
    # Ikonka adaptacyjna (Android 8+): blok w bezpiecznym środku 108 dp.
    size = round(108 * k)
    fg = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    inner = icon.resize((round(size * 0.5),) * 2, Image.NEAREST)
    fg.paste(inner, ((size - inner.width) // 2,) * 2)
    fg.save(f'{folder}/ic_launcher_foreground.png')

icon.resize((512, 512), Image.NEAREST).save('android/ikonka-512.png')
print('Ikonki Androida gotowe')
