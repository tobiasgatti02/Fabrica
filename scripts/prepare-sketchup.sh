#!/usr/bin/env bash

set -euo pipefail

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "Uso: scripts/prepare-sketchup.sh modelo.skp [modelo-optimizado.glb]" >&2
  exit 2
fi

source_path=$1
if [[ ! -f "$source_path" ]]; then
  echo "No existe el archivo: $source_path" >&2
  exit 2
fi

source_name=$(basename "$source_path")
source_stem=${source_name%.*}
source_ext=${source_name##*.}
if [[ ${source_ext:l} != skp ]]; then
  echo "La entrada debe ser un archivo .skp" >&2
  exit 2
fi

source_dir=$(cd "$(dirname "$source_path")" && pwd)
repo_dir=$(cd "$(dirname "$0")/.." && pwd)
optimizer=(npx --yes @gltf-transform/cli@4.5.0)

if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
  echo "Docker debe estar instalado y en ejecución para leer SKP." >&2
  exit 2
fi

if [[ $# -eq 2 ]]; then
  output_path=$2
else
  output_path="$source_dir/${source_stem}-optimized.glb"
fi
output_dir=$(cd "$(dirname "$output_path")" && pwd)
output_path="$output_dir/$(basename "$output_path")"

converter_image=${FABRICA_SKP_CONVERTER_IMAGE:-ghcr.io/lparksi/skp2gltf:latest}
work_dir=$(mktemp -d "${TMPDIR:-/tmp}/fabrica-sketchup.XXXXXX")
cleanup() {
  rm -rf "$work_dir"
}
trap cleanup EXIT

echo "Convirtiendo $source_name a glTF sin compresión…"
docker run --rm \
  -v "$source_dir:/input:ro" \
  -v "$work_dir:/output" \
  "$converter_image" \
  "/input/$source_name" /output source glb

raw_model="$work_dir/source.glb"
if [[ ! -f "$raw_model" ]]; then
  echo "El conversor no produjo source.glb" >&2
  exit 1
fi

echo "Deduplicando, instanciando y comprimiendo para el visor…"
"${optimizer[@]}" optimize "$raw_model" "$output_path" \
  --compress draco \
  --texture-compress webp \
  --texture-size 1024 \
  --flatten false \
  --join false \
  --instance true \
  --simplify true \
  --simplify-error 0.0001 \
  --simplify-ratio 0

echo "Validando resultado…"
validation=$("${optimizer[@]}" validate "$output_path" 2>&1)
if ! grep -q "No errors found" <<<"$validation"; then
  echo "$validation" >&2
  exit 1
fi

source_bytes=$(stat -f %z "$source_path" 2>/dev/null || stat -c %s "$source_path")
output_bytes=$(stat -f %z "$output_path" 2>/dev/null || stat -c %s "$output_path")
echo "Listo: $output_path"
echo "Tamaño: $source_bytes → $output_bytes bytes"
