# Photo quality audit (26 Oct 2026)

Which published photographs are soft because they were exported small, and where the real source files are.

Files: [`photo-quality-audit.csv`](photo-quality-audit.csv) (all 1,028 library photos, one row each, sorted by gallery) · [`photo-quality-re-export-list.txt`](photo-quality-re-export-list.txt) (the 598 source file paths to re-export). Read-only: nothing in `/Volumes/Whiskey` or Lightroom was changed.

## What I found

- **598 of the 1,028 library photographs (58%) were exported far below the size of their source file.** Only 430 are at the full 2560 px long edge.
- **Every one of the 598 has a source file of at least 3,000 px** (20–61 megapixel Sony ARW and DNG, Fuji X100S RAF). The note in the export manifest (`hero_ok: false` means the source was smaller than 2560) does not hold: these were rendered from something smaller than the files on disk, which matches your DNG-preview guess.
- The export sizes cluster at two values: **1616 px (381 photos)** and **1024 px (133 photos)**, plus a few 960–1020 px and 1920–1968 px. Those are the sizes of preview renders, not of the source files.
- It is not specific to DNGs: 423 of the 598 are Sony ARW files, 153 are DNG, 22 are Fuji RAF.
- **The example you sent** (`/m/442b60552ddc/…`, Comic Con 2021) is `_7M30100.dng` from `2021-10-07`, a 6000×4000 file. It was exported at **1024×683 (17% of its source)**, so a full-width page shows it upscaled about 1.4× (2.8× on a retina screen).
- **Full-size exports are sound.** I tested the 430 at 2560 px for detail that an upscaled preview would lack (energy in the finest frequencies). Only 3 scored very low, and looking at them they are simply dark or low-detail frames (a near-black dune shot, a dark bus), not upscales. They are marked `check` in the CSV.
- Your own admin uploads (the `bogota` gallery, 24 photos) are all 3000 px: fine.

## By gallery

`tiny` = under 1200 px (the worst: 1024 and below). `small` = 1200–1999 px (mostly 1616). Galleries not listed have every photo at 2560 px.

| Gallery | Photos | Full size (2560) | Small (1616) | Tiny (≤1024) | Needs re-export |
|---|---:|---:|---:|---:|---:|
| Cartagena | 92 | 1 | 88 | 3 | **91** |
| Arizona | 66 | 1 | 61 | 4 | **65** |
| New York | 92 | 29 | 60 | 3 | **63** |
| Medellín | 52 | 0 | 52 | 0 | **52** |
| Westminster 2021 | 54 | 10 | 9 | 35 | **44** |
| Texas | 43 | 0 | 43 | 0 | **43** |
| Comic Con 2021 | 35 | 3 | 0 | 32 | **32** |
| Comic Con 2022 | 84 | 52 | 0 | 32 | **32** |
| Westminster 2020 | 40 | 12 | 28 | 0 | **28** |
| Wyoming | 69 | 44 | 0 | 25 | **25** |
| Iceland | 21 | 0 | 21 | 0 | **21** |
| Lisbon | 20 | 0 | 20 | 0 | **20** |
| Madeira | 20 | 0 | 20 | 0 | **20** |
| New Mexico | 22 | 3 | 17 | 2 | **19** |
| Japan | 15 | 0 | 15 | 0 | **15** |
| Norway | 23 | 10 | 0 | 13 | **13** |
| Costa Rica | 6 | 0 | 3 | 3 | **6** |
| Colorado | 33 | 30 | 1 | 2 | **3** |
| Stockholm | 6 | 3 | 0 | 3 | **3** |
| Brighton | 8 | 7 | 0 | 1 | **1** |
| New Jersey | 21 | 20 | 0 | 1 | **1** |
| Seoul | 3 | 2 | 1 | 0 | **1** |

All full size: Amsterdam, Barbados, Bogotá, Ecuador, London, Mexico City, Oaxaca, Pennsylvania, Rio, São Paulo, Toko (hidden).

## The tiny ones, by gallery (re-export these first)

File name, capture date, export size, published id (`/m/<id>/w1440.webp?r=2`). The full path of each is in the CSV.

### Westminster 2021 (35)

`_7M35933.dng` 2021-06-11 (683x1024) `2dfef51383c4`, `_7M35947.dng` 2021-06-11 (683x1024) `291413ba4323`, `_7M35955.dng` 2021-06-11 (683x1024) `bc9a465a8e8f`, `_7M35975.dng` 2021-06-11 (683x1024) `6148ff236002`, `_7M35973.dng` 2021-06-11 (683x1024) `87c41d6f4fc7`, `_7M36038.dng` 2021-06-11 (683x1024) `6f12631753b9`, `_7M36118.dng` 2021-06-11 (683x1024) `c065b062f353`, `_7M36179.dng` 2021-06-11 (683x1024) `ed38c671ba09`, `_7M36182.dng` 2021-06-11 (683x1024) `e64dfa0145fe`, `_7M36184.dng` 2021-06-11 (683x1024) `4189779798de`, `_7M36186.dng` 2021-06-11 (683x1024) `21c1ca986ed2`, `_7M36241.dng` 2021-06-11 (1024x683) `70e2b1c40534`, `_7M36289.dng` 2021-06-11 (683x1024) `ceada25a2ca6`, `_7M36350.dng` 2021-06-11 (683x1024) `45f2a82f0a3f`, `_7M36653.dng` 2021-06-11 (683x1024) `9ef3f2134f25`, `_7M37556.dng` 2021-06-12 (683x1024) `ea8f4e397211`, `_7M37558.dng` 2021-06-12 (683x1024) `a8f2d8e3e819`, `_7M37567.dng` 2021-06-12 (683x1024) `62f5a591e097`, `_7M37584.dng` 2021-06-12 (683x1024) `184c9ab87941`, `_7M37591.dng` 2021-06-12 (1024x683) `f05a1ce555d3`, `_7M37593.dng` 2021-06-12 (683x1024) `64358849a35e`, `_7M37598.dng` 2021-06-12 (683x1024) `3303031e0c9d`, `_7M37602.dng` 2021-06-12 (683x1024) `943bbbea9679`, `_7M37604.dng` 2021-06-12 (683x1024) `a690c30b4674`, `_7M37612.dng` 2021-06-12 (683x1024) `093d386c8548`, `_7M37627.dng` 2021-06-12 (683x1024) `f16207fd4b89`, `_7M37630.dng` 2021-06-12 (683x1024) `fe34ca3976cf`, `_7M37632.dng` 2021-06-12 (1024x683) `64d6d3c68492`, `_7M37636.dng` 2021-06-12 (683x1024) `8702596d1c41`, `_7M37638.dng` 2021-06-12 (683x1024) `bc2563400f68`, `_7M37642.dng` 2021-06-12 (683x1024) `0e4910007e7e`, `_7M37649.dng` 2021-06-12 (683x1024) `9c419ef70ad3`, `_7M37653.dng` 2021-06-12 (683x1024) `afab491f0f6f`, `_7M37659.dng` 2021-06-12 (683x1024) `b291ec1cd77e`, `_7M37665.dng` 2021-06-12 (683x1024) `776e40f05d2a`

### Comic Con 2021 (32)

`_7M39551.dng` 2021-10-06 (683x1024) `e52d23f5d013`, `_7M39552.dng` 2021-10-06 (1024x683) `f0f332a607d4`, `_7M39558.dng` 2021-10-06 (1024x683) `2c105508b8b5`, `_7M39568.dng` 2021-10-06 (683x1024) `1f52d6d9dee7`, `_7M39571.dng` 2021-10-06 (683x1024) `9c1d3c33a692`, `_7M39654.dng` 2021-10-06 (683x1024) `65224121a305`, `_7M39663.dng` 2021-10-06 (683x1024) `10168e499494`, `_7M39679.dng` 2021-10-06 (683x1024) `e9bbba11c479`, `_7M39693.dng` 2021-10-06 (683x1024) `3d3365c148e0`, `_7M39711.dng` 2021-10-06 (683x1024) `a77410b9eb54`, `_7M39785.dng` 2021-10-07 (683x1024) `26dcc68ba878`, `_7M39806.dng` 2021-10-07 (683x1024) `61f4f40130d4`, `_7M39814.dng` 2021-10-07 (683x1024) `ec3108241159`, `_7M39839.dng` 2021-10-07 (651x976) `40a9e1e45323`, `_7M39849.dng` 2021-10-07 (1024x683) `7c0196d26ff8`, `_7M39889.dng` 2021-10-07 (683x1024) `c085c72b6d27`, `_7M39910.dng` 2021-10-07 (1024x683) `debae1dddb7e`, `_7M39912.dng` 2021-10-07 (683x1024) `647d73a95eb6`, `_7M39937.dng` 2021-10-07 (683x1024) `a73ccff4fea3`, `_7M39997.dng` 2021-10-07 (683x1024) `09dadfff7c9a`, `_7M30025.dng` 2021-10-07 (683x1024) `6a8c8fc3c7e3`, `_7M30029.dng` 2021-10-07 (683x1024) `a01b398a058d`, `_7M30100.dng` 2021-10-07 (1024x683) `442b60552ddc`, `_7M30110.dng` 2021-10-07 (1024x683) `41edd51bae07`, `_7M30116.dng` 2021-10-07 (683x1024) `7394d0ad6877`, `_7M30118.dng` 2021-10-07 (683x1024) `db8dac24a162`, `_7M30127.dng` 2021-10-07 (1024x683) `ba0089fe4be9`, `_7M30131.dng` 2021-10-07 (683x1024) `52103c1a3e86`, `_7M30135.dng` 2021-10-07 (1024x683) `6a0acd7fcca0`, `_7M30185.dng` 2021-10-07 (683x1024) `3c2e07b68f84`, `_7M30271.dng` 2021-10-07 (683x1024) `30e6b538f7ab`, `_7M31600.dng` 2021-10-08 (683x1024) `99f4b21c00c6`

### Comic Con 2022 (32)

`DSC00105.dng` 2022-10-06 (683x1024) `79165a7747fc`, `DSC00109.dng` 2022-10-06 (683x1024) `9a255de1d09a`, `DSC00111.dng` 2022-10-06 (683x1024) `830d0574b632`, `DSC00144.dng` 2022-10-07 (683x1024) `b8ebe6e47099`, `DSC00147.dng` 2022-10-07 (683x1024) `a87b715d0f78`, `DSC00150.dng` 2022-10-07 (683x1024) `ea639a58f70b`, `DSC00156.dng` 2022-10-07 (683x1024) `5ea8c6d685e2`, `DSC00166.dng` 2022-10-07 (683x1024) `74b32e66161e`, `DSC00170.dng` 2022-10-07 (683x1024) `ddb1e3f7a124`, `DSC00173.dng` 2022-10-07 (609x913) `cd893c0a0206`, `DSC00178.dng` 2022-10-07 (651x977) `7153daf3dc1b`, `DSC00225.dng` 2022-10-07 (683x1024) `86a97559293b`, `DSC00234.dng` 2022-10-07 (683x1024) `d78d44b72c0c`, `DSC00253.dng` 2022-10-07 (683x1024) `de5bb34041dc`, `DSC00265.dng` 2022-10-07 (683x1024) `3dda3363cf5d`, `DSC00273.dng` 2022-10-07 (683x1024) `f3aff06d6945`, `DSC00280.dng` 2022-10-07 (1024x683) `01e6f05fa601`, `DSC00294.dng` 2022-10-07 (1024x683) `3c5f55199ea9`, `DSC00295.dng` 2022-10-07 (1024x683) `d0d3b452dce9`, `DSC00297.dng` 2022-10-07 (1024x683) `24357d7caaf6`, `DSC00308.dng` 2022-10-07 (1024x683) `154aa19ba6b2`, `DSC00310.dng` 2022-10-07 (1024x683) `1b36f9807543`, `DSC00314.dng` 2022-10-07 (1024x683) `985a9dae2737`, `DSC00316.dng` 2022-10-07 (1024x683) `19f512db761d`, `DSC00374.dng` 2022-10-07 (683x1024) `f2ebd172f543`, `DSC00380.dng` 2022-10-07 (683x1024) `3009a252a778`, `DSC00383.dng` 2022-10-07 (683x1024) `86704835fe19`, `DSC00384.dng` 2022-10-07 (1024x683) `205b29243fc9`, `DSC00444.dng` 2022-10-07 (1024x683) `b9fa26d42473`, `DSC00452.dng` 2022-10-07 (1024x683) `8dbef48756c5`, `DSC00454.dng` 2022-10-07 (1024x683) `12b62f8a1a07`, `DSC00456.dng` 2022-10-07 (1024x683) `ad7dc399b05e`

### Wyoming (25)

`DJI_0361.DNG` 2022-09-24 (960x640) `7f03d49056b2`, `DSC00462.dng` 2022-09-24 (683x1024) `1e23ab52f683`, `DSC00467.dng` 2022-09-24 (683x1024) `63f7a8da08e9`, `DSC00478.dng` 2022-09-24 (483x724) `a15882ca1fb7`, `DSC00493.dng` 2022-09-24 (683x1024) `25155cc93172`, `DSC00496.dng` 2022-09-24 (683x1024) `a20c2751d4e6`, `DSC00497.dng` 2022-09-24 (683x1024) `7be11ae5f69a`, `DSC00500.dng` 2022-09-24 (683x1024) `65543556fa4b`, `DJI_0377.DNG` 2022-09-24 (960x640) `5189303f4114`, `DJI_0378.DNG` 2022-09-24 (960x640) `db112e943d2d`, `DJI_0381.DNG` 2022-09-24 (960x640) `48ad4a0bc279`, `DJI_0392.DNG` 2022-09-24 (960x640) `985a4ebd8113`, `DSC00519.dng` 2022-09-24 (683x1024) `f220ed98afa5`, `DSC00630.dng` 2022-09-25 (446x669) `07902d66d045`, `DSC00640.dng` 2022-09-25 (683x1024) `c1f7cc990712`, `DSC00675.dng` 2022-09-25 (479x718) `13abeaefe831`, `DSC00761.dng` 2022-09-25 (683x1024) `293687b2e622`, `DSC00764.dng` 2022-09-25 (683x1024) `1b4e40129cf1`, `DSC00769.dng` 2022-09-25 (575x863) `af7452fcef7f`, `DSC00779.dng` 2022-09-25 (1024x683) `3627cd9ad37a`, `DSC00795.dng` 2022-09-25 (819x546) `795fd5f87f52`, `DSC00866.dng` 2022-09-26 (1024x683) `c20ed7330cdd`, `DSC00869.dng` 2022-09-26 (1024x683) `23d9b3b0d453`, `DSC00872.dng` 2022-09-26 (683x1024) `f93ded623474`, `DSC00873.dng` 2022-09-26 (683x1024) `4e82048d0918`

### Norway (13)

`_7M39779.dng` 2022-09-05 (460x690) `ebb87d81fd3c`, `_7M39847.dng` 2022-09-05 (683x1024) `2d2cd3623414`, `_7M39867.dng` 2022-09-05 (683x1024) `6caa5ce23347`, `_7M39917.dng` 2022-09-05 (683x1024) `ea659deb9913`, `_7M39918.dng` 2022-09-05 (640x959) `a10f719a144e`, `_7M39927.dng` 2022-09-05 (683x1024) `de8eabec240b`, `_7M30040.dng` 2022-09-06 (613x918) `926569d165cc`, `_7M30059.dng` 2022-09-07 (683x1024) `15292329fe55`, `_7M30084.dng` 2022-09-07 (683x1024) `413bc8d3c170`, `_7M30090.dng` 2022-09-07 (683x1024) `bbc5fd6d35cb`, `_7M30102.dng` 2022-09-07 (1024x683) `7f2decbdcef4`, `_7M30195.dng` 2022-09-07 (683x1024) `27b93d33ed2f`, `_7M30214.dng` 2022-09-07 (683x1024) `50ebb39e114e`

### Arizona (4)

`_7M32797-HDR.dng` 2021-11-18 (1020x680) `192cf1fa8f0f`, `_7M32815-HDR.dng` 2021-11-18 (681x1020) `f221f4af5168`, `_7M33207.ARW` 2021-11-19 (749x1121) `3616e7054995`, `_7M33403.ARW` 2021-11-20 (1161x873) `32027f6508d9`

### Cartagena (3)

`DSC06337-HDR.dng` 2020-02-01 (683x1024) `7b7e35736e5d`, `DSC06573.ARW` 2020-02-01 (912x1137) `01458fe03871`, `DSC07512-HDR.dng` 2020-02-02 (683x1024) `1c5a71729fc5`

### Costa Rica (3)

`DSCF6707.RAF` 2019-12-11 (583x730) `ab2af5528ebc`, `DSCF6708.RAF` 2019-12-11 (816x1020) `9e46d1de7d00`, `DSCF6958.RAF` 2019-12-12 (551x689) `e0836313a1dc`

### New York (3)

`_7M39265.dng` 2021-08-20 (683x1024) `e95c8fea03e6`, `_7M32250.dng` 2021-10-21 (1024x683) `6aa173032f13`, `_7M32261.dng` 2021-10-21 (683x1024) `2ad16d709a39`

### Stockholm (3)

`_7M39343.dng` 2022-09-01 (683x1024) `73cc68d9429c`, `_7M39364.dng` 2022-09-01 (588x881) `9e90f7b8305c`, `_7M39506.dng` 2022-09-02 (683x1024) `1bd1d1fea07a`

### Colorado (2)

`_7M38416.dng` 2021-08-05 (683x1024) `26ecce2a01b8`, `_7M39162.dng` 2021-08-07 (683x1024) `3949f020fa70`

### New Mexico (2)

`_7M33601.ARW` 2021-12-17 (730x1093) `0e04fdaa284d`, `_7M33913-HDR.dng` 2021-12-17 (683x1024) `834342aaf93d`

### Brighton (1)

`DSC00065-Enhanced-NR.dng` 2023-05-07 (683x1024) `f54cde540dfa`

### New Jersey (1)

`_7M39276.dng` 2022-08-19 (683x1024) `999fd648ca61`

## How to use this

1. In Lightroom, find a photo by file name and capture date (the CSV has the Lightroom collection and the full path). The 598 paths in the re-export list can be pasted into a script or used to build a collection by file name.
2. Export them from the **source file** (not the previews) at 2560 px on the long edge, JPEG, into the web2560 folder structure the publisher reads, then rerun `scripts/publish-library.mjs` (it replaces by id and bumps `rev` so caches refresh).
3. Anything that stays under 2560 after that should not be used as a full-width hero (`hero_ok`).

## Method

Sizes come from the export manifest (`photos/web2560/manifest.json`) and the real pixel size of each source file (`exiftool`, read-only). Published ids are `sha1("lib:" + manifest id)[:12]`, checked against the live database for the example. Detail check: for each of the 430 full-size exports, the ratio of energy in the finest frequency band to a mid band, on the four most detailed 512 px tiles; calibrated by upscaling the 1024 and 1616 exports to 2560, which drops the score 10–100×.
