# nykelab: what the site needs from Lightroom exports

Paste this into the Lightroom / plugin chat. It describes the nykelab upload pipeline as it exists today and what metadata the site wants to read from each photo.

## What the site does with a photo today

- Photos are uploaded through the site's admin as **originals** (no resizing in the browser any more). The Worker stores the file untouched in R2 as `<id>/orig.<ext>`.
- Accepted: **JPEG, PNG, WebP**. Not accepted yet: HEIC, AVIF, TIFF, RAW. Photos up to 200 MB, MP4/WebM video up to 2 GB.
- Sized WebP versions (480 / 900 / 1440 / 2400 px wide) are generated from the original by Cloudflare Images on first request and never upscale. So **export at full size, or at least 2400 px on the long edge**. No need to pre-resize.
- The browser reads pixel size honouring EXIF orientation. That is all it reads today.
- **EXIF is not read anywhere yet.** The database only has a free-text `place`, a multi-line `caption`, width/height and the upload date. Reading EXIF at upload is the next planned step.

## Metadata the site wants (for the home page "Where / When / How" views and future Places / Years pages)

| Field | EXIF / IPTC source | Used for |
|---|---|---|
| Capture time (local) | `DateTimeOriginal` (+ `OffsetTimeOriginal` if present) | When view, Years, golden-hour share. Needs local time, so the timezone matters |
| Latitude / longitude | GPS tags | Where globe, Places map |
| Place name | IPTC City / State / Country (fallback when no GPS) | Place tiles, captions |
| Focal length, aperture, ISO, shutter | `FocalLength`, `FNumber`, `ISO`, `ExposureTime` | How view, "most often 70mm f/8" |
| Lens, camera | `LensModel`, `Make`/`Model` | Gear lens (later) |
| Caption | IPTC Caption/Description | Shown under the photo (short, lines allowed) |

## Export settings to use

- Format JPEG, quality 90 or higher, sRGB. Long edge: original (or at least 2400 px).
- **Metadata: include "All Metadata"**, so EXIF/GPS/IPTC survive. Do not tick "Remove Location Info" or "Remove Person Info" if you want locations on the site.
- Privacy: the public site will never serve the original file. It serves generated WebP variants. (I have not yet verified that the Images binding strips EXIF from those variants; that check is on the to-do list before real GPS goes live.) Public coordinates are planned to be rounded to roughly city level; exact values stay admin-only.

## The gap: photos with no GPS

Not every photo has GPS. Options, in order of preference:

1. Write GPS in Lightroom beforehand (Map module, or sync a GPX track log).
2. Fill IPTC **City / State / Country** (or a keyword hierarchy) so the site can place the photo by name.
3. A per-voyage default location (the site groups photos into "voyages"/collections): photos without GPS inherit the voyage's location.

Capture time is always present, so When/Years/How work for every photo; only Where/Places depend on location.

## Open questions for the library side

- Roughly what share of the library has GPS, and what share has IPTC City/Country?
- Is the camera clock set to local time, and is `OffsetTimeOriginal` written (newer bodies)? Without GPS or an offset, time-of-day charts can be off by the timezone.
- Could the plugin also write a small manifest (CSV/JSON: filename → voyage, place, caption, optional lat/lon override) next to the exports? The site has no importer for it yet, but it would make bulk upload and place overrides easy to add.
