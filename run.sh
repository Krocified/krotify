#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v adb >/dev/null 2>&1; then
  echo "adb not found. Install Android platform-tools and put adb on PATH."
  exit 1
fi

devices=$(adb devices | awk 'NR>1 && $2=="device" {print $1}')
if [ -z "$devices" ]; then
  echo "No Android device detected."
  echo "1. Enable Developer options and USB debugging on the phone"
  echo "2. Plug it in and accept the RSA prompt"
  echo "3. Confirm with: adb devices"
  exit 1
fi

echo "Building and installing krotify on: $devices"
exec npx expo run:android --device
