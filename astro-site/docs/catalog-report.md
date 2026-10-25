# Catalog build report

Source: `photos-3plus-or-picked.csv`. Regenerate: `npm run catalog -- <csv>`. Overrides: `scripts/catalog/clock-overrides.json`.

- 7393 rows -> **6678 photographs** in **35 voyages**
- dropped: 70 rejects, 644 duplicates (same photo in several collections), 0 without a capture date, 1 not near any voyage's dates

## Voyages

| voyage | kind | photos | dates | place | clock flips |
|---|---|---:|---|---|---|
| Japan | trip | 22 | 2015-06-11 to 2015-06-11 | Tokyo, Japan (**approximate**) | 22 photos in 1 group(s) |
| Seoul | trip | 3 | 2016-06-28 to 2016-06-29 | Seoul, South Korea |  |
| London | trip | 41 | 2017-05-16 to 2017-05-25 | London, England |  |
| Amsterdam | trip | 24 | 2017-05-19 to 2017-05-21 | Amsterdam, Netherlands |  |
| Iceland | trip | 31 | 2017-05-25 to 2017-05-26 | Iceland (**approximate**) |  |
| Barbados | trip | 10 | 2017-11-02 to 2017-11-05 | Barbados |  |
| Rio | trip | 69 | 2019-02-23 to 2019-02-25 | Rio de Janeiro, Brazil |  |
| São Paulo | trip | 35 | 2019-02-26 to 2019-03-03 | São Paulo, Brazil |  |
| Mexico City | trip | 50 | 2019-05-03 to 2019-05-05 | Mexico City |  |
| Costa Rica | trip | 7 | 2019-12-11 to 2019-12-12 | Costa Rica (**approximate**) |  |
| Wyoming 2020 | trip | 123 | 2020-01-05 to 2020-01-08 | Grand Teton and Yellowstone, Wyoming |  |
| Medellín | trip | 1051 | 2020-01-28 to 2020-01-31 | Medellín, Colombia | 733 photos in 4 group(s) |
| Cartagena | trip | 986 | 2020-01-29 to 2020-02-02 | Cartagena, Colombia | 928 photos in 1 group(s) |
| Westminster 2020 | event | 135 | 2020-02-08 to 2020-02-08 | Piers 92/94, New York | 135 photos in 1 group(s) |
| New York | home | 502 | 2020-03-20 to 2025-11-30 | New York City | 79 photos in 4 group(s) |
| Eureka | trip | 164 | 2020-11-04 to 2020-11-07 | Eureka, California | 128 photos in 1 group(s) |
| San Francisco | trip | 47 | 2020-11-09 to 2020-11-09 | San Francisco, California |  |
| Texas | trip | 758 | 2021-02-06 to 2021-02-09 | Texas (**approximate**) | 453 photos in 3 group(s) |
| Westminster 2021 | event | 468 | 2021-06-10 to 2021-06-12 | Lyndhurst, Tarrytown, New York | 263 photos in 2 group(s) |
| Colorado | trip | 361 | 2021-08-05 to 2021-08-07 | Colorado (**approximate**) |  |
| NYCC 2021 | event | 69 | 2021-10-06 to 2021-10-08 | Javits Center, New York | 68 photos in 2 group(s) |
| Arizona | trip | 154 | 2021-11-17 to 2021-11-20 | Sedona, Arizona | 56 photos in 1 group(s) |
| New Mexico | trip | 138 | 2021-12-17 to 2021-12-18 | New Mexico (**approximate**) |  |
| Lisbon | trip | 37 | 2022-04-02 to 2022-04-02 | Lisbon, Portugal |  |
| Madeira | trip | 227 | 2022-04-04 to 2022-04-05 | Madeira, Portugal |  |
| Stockholm | trip | 12 | 2022-09-01 to 2022-09-09 | Stockholm, Sweden |  |
| Norway | trip | 289 | 2022-09-03 to 2022-09-07 | Norway (**approximate**) |  |
| Wyoming 2022 | trip | 194 | 2022-09-23 to 2022-09-26 | Grand Teton and Yellowstone, Wyoming |  |
| NYCC 2022 | event | 120 | 2022-10-06 to 2022-10-08 | Javits Center, New York |  |
| Brighton | trip | 7 | 2023-05-07 to 2023-05-07 | Brighton, England |  |
| Ecuador | trip | 162 | 2023-05-09 to 2023-05-12 | Ecuador (refined from 13 GPS photos) |  |
| Bogotá | trip | 231 | 2023-05-12 to 2023-05-14 | Bogotá, Colombia |  |
| Oaxaca | trip | 77 | 2025-02-19 to 2025-02-26 | Oaxaca, Mexico |  |
| New Jersey | trip | 70 | 2025-04-26 to 2025-05-25 | New Jersey (**approximate**) |  |
| Sesame Place | trip | 4 | 2025-06-29 to 2025-06-29 | Sesame Place, Pennsylvania (**approximate**) |  |

## Clock: groups flipped by 12 hours (same date)

Rule: at least 12 photos from one camera on one date, at least 80% at night by the wall clock and at most 10% at night once flipped. `dark` = night before, `after` = night after the flip.

| voyage / camera / date | photos | dark | after |
|---|---:|---:|---:|
| new-york / SONY ILCE-7M3 / 2021-03-26 | 15 | 100% | 0% |
| new-york / SONY ILCE-7M3 / 2021-04-06 | 35 | 100% | 0% |
| cartagena / SONY ILCE-7M3 / 2020-02-01 | 928 | 89% | 0% |
| eureka / SONY ILCE-7M3 / 2020-11-07 | 128 | 100% | 0% |
| westminster-2021 / SONY ILCE-7M3 / 2021-06-12 | 34 | 100% | 0% |
| medellin / SONY ILCE-7M3 / 2020-01-28 | 14 | 100% | 0% |
| medellin / SONY DSC-RX100M4 / 2020-01-29 | 20 | 100% | 0% |
| medellin / SONY ILCE-7M3 / 2020-01-29 | 393 | 95% | 5% |
| medellin / SONY ILCE-7M3 / 2020-01-30 | 306 | 92% | 1% |
| nycc-2021 / SONY ILCE-7M3 / 2021-10-06 | 25 | 100% | 0% |
| nycc-2021 / SONY ILCE-7M3 / 2021-10-07 | 43 | 100% | 0% |
| texas / SONY ILCE-7M3 / 2021-02-06 | 26 | 100% | 0% |
| westminster-2021 / SONY ILCE-7M3 / 2021-06-11 | 229 | 97% | 0% |
| westminster-2020 / SONY ILCE-7M3 / 2020-02-08 | 135 | 100% | 0% |
| arizona / SONY ILCE-7M3 / 2021-11-18 | 56 | 100% | 5% |
| japan / FUJIFILM X100S / 2015-06-11 | 22 | 86% | 0% |
| new-york / SONY ILCE-7M3 / 2021-01-10 | 14 | 100% | 0% |
| texas / SONY ILCE-7M3 / 2021-02-07 (follows a flipped day, same camera and voyage) | 322 | 88% | 12% |
| texas / SONY ILCE-7M3 / 2021-02-09 (follows a flipped day, same camera and voyage) | 105 | 74% | 26% |
| new-york / SONY ILCE-7M3 / 2021-04-13 (follows a flipped day, same camera and voyage) | 15 | 53% | 0% |

## Clock: groups that look off but were NOT flipped

At least half at night, and flipping would fix most of it, but not clearly enough. Could be real night or evening shooting. Decide with brightness, then add to the overrides file.

| voyage / camera / date | photos | dark | after |
|---|---:|---:|---:|
| amsterdam / FUJIFILM X100S / 2017-05-20 | 12 | 75% | 0% |
| bogota / LEICA CAMERA AG LEICA Q2 MONO / 2023-05-13 | 36 | 75% | 6% |
| london / FUJIFILM X100S / 2017-05-19 | 12 | 50% | 0% |
| norway / SONY ILCE-7M3 / 2022-09-07 | 134 | 58% | 0% |
| sao-paulo / FUJIFILM X100S / 2019-02-28 | 17 | 59% | 18% |

## Moved between voyages by date

Photos in a collection that sit outside its voyage's dates, placed with the voyage whose dates contain them.

- Eureka Finals -> Texas (2021-02-08): 1
- Medellin Finals -> Texas (2021-02-07): 3
- Texas Finals -> New Mexico (2021-12-17): 1

## Left out

- New Jersey (2022-08) not near any voyage: 1 photos
