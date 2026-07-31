#!/usr/bin/env bash

set -euo pipefail

readonly build_root='ios/build'
readonly products_dir="${build_root}/Build/Products/Debug-iphonesimulator"
readonly detox_app="${products_dir}/ForumoMobile.app"

workspace="$(find ios -maxdepth 1 -name '*.xcworkspace' -print -quit)"
if [[ -z "${workspace}" ]]; then
  echo 'No iOS workspace found. Run Expo prebuild and CocoaPods before Detox.' >&2
  exit 1
fi

scheme="$(basename "${workspace}" .xcworkspace)"
xcodebuild \
  -workspace "${workspace}" \
  -scheme "${scheme}" \
  -configuration Debug \
  -sdk iphonesimulator \
  -derivedDataPath "${build_root}" \
  CODE_SIGNING_ALLOWED=NO

built_app="$(find "${products_dir}" -maxdepth 1 -name '*.app' ! -name 'ForumoMobile.app' -print -quit)"
if [[ ! -d "${detox_app}" && -n "${built_app}" ]]; then
  cp -R "${built_app}" "${detox_app}"
fi

if [[ ! -d "${detox_app}" ]]; then
  echo "The iOS build did not produce ${detox_app}." >&2
  exit 1
fi
