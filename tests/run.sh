#!/usr/bin/env bash
# Runs the unit tests with plain gjs. tools.js imports Clutter, whose typelib
# ships with mutter rather than on the default GI path.
set -euo pipefail
cd "$(dirname "$0")/.."

mutter_dir=$(compgen -G '/usr/lib64/mutter-*' | sort -V | tail -n1 || true)
if [[ -z "${mutter_dir}" ]]; then
    echo "No /usr/lib64/mutter-* typelib directory found" >&2
    exit 1
fi
export GI_TYPELIB_PATH="${mutter_dir}${GI_TYPELIB_PATH:+:${GI_TYPELIB_PATH}}"

status=0
for t in tests/*.test.js; do
    echo "== ${t}"
    gjs -m "${t}" || status=1
done
exit "${status}"
