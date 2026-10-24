#!/usr/bin/env bash
# Seeds the LOCAL D1 + R2 (in astro-site/.wrangler/state) with the Figma photos so
# the photo pages have something to render. Safe to re-run. Never touches production.
set -euo pipefail
cd "$(dirname "$0")/.."
P=.wrangler/state
TMP=seed/.tmp; rm -rf "$TMP"; mkdir -p "$TMP"

npx wrangler d1 migrations apply DB --local --persist-to "$P" >/dev/null

# file | collection | orientation | caption | place
ITEMS=(
  "hero|grand-tetons|landscape|Mount Moran at first light.\nGrand Teton National Park, Wyoming|Oxbow Bend, Wyoming"
  "port1|grand-tetons|portrait|Evergreens above the valley.\nGrand Teton National Park, Wyoming|Grand Teton National Park, Wyoming"
  "port2|grand-tetons|portrait|The range after sunset.\nGrand Teton National Park, Wyoming|Grand Teton National Park, Wyoming"
  "port3|grand-tetons|portrait|Fog first, then color.\nGrand Teton National Park, Wyoming|Grand Teton National Park, Wyoming"
  "fullbleed|grand-tetons|landscape|Grand Teton National Park, Wyoming|Grand Teton National Park, Wyoming"
  "port4|grand-tetons|portrait|Ridgeline in last light.\nGrand Teton National Park, Wyoming|Grand Teton National Park, Wyoming"
  "port5|grand-tetons|portrait|Silhouette.\nGrand Teton National Park, Wyoming|Grand Teton National Park, Wyoming"
  "land1|grand-tetons|landscape|Valley floor, early morning.\nGrand Teton National Park, Wyoming|Grand Teton National Park, Wyoming"
  "land2|grand-tetons|landscape|Grand Teton National Park, Wyoming|Grand Teton National Park, Wyoming"
  "west|westminster|portrait|Westminster Kennel Club Dog Show.\nNew York|New York"
)

SQL="$TMP/seed.sql"
cat > "$SQL" <<'SQLEOF'
INSERT OR REPLACE INTO collections (slug, title, position, published) VALUES
  ('westminster', 'Westminster', 1, 1),
  ('grand-tetons', 'Grand Tetons', 2, 1);
SQLEOF

pos=0
for row in "${ITEMS[@]}"; do
  IFS='|' read -r f col orient caption place <<<"$row"
  id=$(printf '%s' "$f" | md5 | cut -c1-12)
  w=$(sips -g pixelWidth "seed/$f.jpg" | awk '/pixel/{print $2}')
  h=$(sips -g pixelHeight "seed/$f.jpg" | awk '/pixel/{print $2}')
  cp "seed/$f.jpg" "$TMP/$f-main.jpg"
  sips -Z 900 "seed/$f.jpg" --out "$TMP/$f-small.jpg" >/dev/null
  npx wrangler r2 object put "nykelab-media/$id/main.jpg"  --file "$TMP/$f-main.jpg"  --content-type image/jpeg --local --persist-to "$P" >/dev/null
  npx wrangler r2 object put "nykelab-media/$id/small.jpg" --file "$TMP/$f-small.jpg" --content-type image/jpeg --local --persist-to "$P" >/dev/null
  size=$(stat -f%z "$TMP/$f-main.jpg")
  cap=$(printf '%b' "$caption" | sed "s/'/''/g" | awk '{printf "%s%s", (NR>1?"'"'"' || char(10) || '"'"'":""), $0}')
  plc=$(printf '%s' "$place" | sed "s/'/''/g")
  echo "INSERT OR REPLACE INTO media (id, collection, type, caption, place, orientation, width, height, position, published, featured, key_main, key_small, size_bytes) VALUES ('$id', '$col', 'image', '$cap', '$plc', '$orient', $w, $h, $pos, 1, 0, '$id/main.jpg', '$id/small.jpg', $size);" >> "$SQL"
  pos=$((pos+1))
done

npx wrangler d1 execute DB --local --persist-to "$P" --file "$SQL" >/dev/null
rm -rf "$TMP"
echo "Seeded $pos images into local D1/R2. Run: npm run dev"
