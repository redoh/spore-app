# Spore (Mobil)

Will Wright'ın Spore oyununun mobil versiyonu — tek bir hücreden başla,
yiyecek topla, evrim geçir, galaksiyi ele geçir.

> Şu anki sürüm **MVP**: yalnızca **Hücre Evresi** oynanabilir. Yaratık, Kabile,
> Medeniyet ve Uzay evreleri yol haritasında.

## Yığın

- [Expo](https://docs.expo.dev/) (React Native) — iOS + Android tek kod tabanı
- [@shopify/react-native-skia](https://shopify.github.io/react-native-skia/)
  — GPU hızlandırmalı 2D çizim
- [Zustand](https://github.com/pmndrs/zustand) — global oyun durumu
- TypeScript

## Çalıştırma

```bash
npm install
npm run start
```

Telefonunuza **Expo Go** uygulamasını kurun, ardından terminalde çıkan QR
kodu okutun (iOS: kamera; Android: Expo Go içinden tara).

Yalnızca simülatörde test etmek için:

```bash
npm run ios       # macOS + Xcode gerekir
npm run android   # Android Studio + emulator gerekir
```

## Oynanış

- **Hareket**: Ekrana dokunup parmağını sürükle. Parmağın hücreden ne kadar
  uzaklaşırsa, hücre o yönde o kadar hızlı yüzer.
- **Yiyecek**: Yeşil noktalar bitki, kırmızı noktalar et. Bitki yersen
  otçul, et yersen etçil yola girersin; ikisini de yersen hepçil olursun.
- **Diğer hücreler**: Yeşil olanlar senden küçük → yenebilir. Sarı olanlar
  yakın boyutta → tehlikeli ama kazanılabilir. Kırmızı olanlar büyük →
  uzak dur veya diken/zırh tak.
- **DNA**: Yedikçe DNA biriktirir. **EVRİL** butonuna basıp parça satın
  alıp tak: Diken, Çene, Kamçı, Süzgeç, Göz, Kabuk.
- **Hayatta kalma**: Can sıfıra inerse evrimleşememe; yeniden doğarken
  topladığın toplam DNA hatıran kalır.

## Mimari

```
spore-app/
├── App.tsx                        # Durum makinesi (menu | playing | gameover)
├── index.ts                       # Expo entry
├── src/
│   ├── theme.ts                   # Renkler / tipografi
│   ├── game/
│   │   ├── types.ts               # World/Cell/Food/Part tip tanımları
│   │   ├── store.ts               # Zustand: dna, kilitler, en iyi skor
│   │   └── world.ts               # createWorld + stepWorld (saf simülasyon)
│   ├── components/
│   │   ├── HUD.tsx                # Can/DNA bar + diyet rozeti
│   │   └── EvolveModal.tsx        # Parça satın alma & takma sayfası
│   └── screens/
│       ├── MainMenu.tsx
│       ├── CellStage.tsx          # Skia render + dokunma kontrol + ana döngü
│       └── GameOver.tsx
└── babel.config.js                # reanimated plugin
```

`world.ts` saf TypeScript — herhangi bir React import etmiyor; bu sayede
oynanış mantığı testlenebilir ve render katmanından bağımsız.

## Yol Haritası

- [x] Hücre Evresi (MVP)
- [ ] Kara çıkışı animasyonu + Yaratık Evresi (3D olmasa da editör + zıplama)
- [ ] Kabile evresi: sürü AI + ittifak / savaş
- [ ] Medeniyet evresi: şehir kurma + kaynak ekonomisi
- [ ] Uzay evresi: galaksi haritası + sömürgeleştirme
- [ ] Bulut kaydetme (Supabase / Expo SecureStore)
- [ ] Gerçek sprite ve ses

## Lisans

Projenin kodu için `LICENSE` dosyasına bakın. "Spore" markası ve fikri
mülkiyeti **Maxis / Electronic Arts**'a aittir; bu proje yalnızca öğrenme
amaçlı bağımsız bir hayran çalışmasıdır ve onlarla bir ilişkisi yoktur.
