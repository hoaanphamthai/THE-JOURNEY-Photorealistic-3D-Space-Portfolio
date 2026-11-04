#!/usr/bin/env bash
# Convert WebP textures in public/assets/textures to KTX2 with basisu or toktx
# Requires: basisu CLI (https://github.com/BinomialLLC/basis_universal)
# or toktx (KTX-Software: https://github.com/KhronosGroup/KTX-Software)

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEX_DIR="$ROOT/public/assets/textures"

echo "Scanning $TEX_DIR for textures..."

CONVERTED=()

if command -v basisu >/dev/null 2>&1; then
  echo "Using basisu..."
  find "$TEX_DIR" -type f -name "*.webp" | while read -r file; do
    out="${file%.webp}.ktx2"
    echo "Converting $file -> $out"
    basisu -uastc -uastc_level 2 -mipmap -file "$file" -output_path "$(dirname "$out")"
  done
elif command -v toktx >/dev/null 2>&1; then
  echo "Using toktx..."
  find "$TEX_DIR" -type f -name "*.webp" | while read -r file; do
    out="${file%.webp}.ktx2"
    echo "Converting $file -> $out"
    toktx --bcmp --genmipmap "$out" "$file"
  done
else
  echo "Neither basisu nor toktx found on PATH."
  echo "To install basisu: https://github.com/BinomialLLC/basis_universal/releases"
  echo "To install toktx:  https://github.com/KhronosGroup/KTX-Software/releases"
  echo "Note: The website runs automatically with high-quality WebP textures out of the box."
  exit 0
fi

# Update index of available KTX2 textures
node -e '
  const fs = require("fs");
  const path = require("path");
  const root = "public/assets/textures";
  const list = [];
  function walk(dir) {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (f.endsWith(".ktx2")) list.push("/" + p.replace(/\\/g, "/").replace(/^public\//, ""));
    }
  }
  walk(root);
  fs.writeFileSync("public/assets/ktx2.json", JSON.stringify(list, null, 2));
  console.log("Updated public/assets/ktx2.json with " + list.length + " KTX2 assets.");
'
