#!/usr/bin/env bash
# Runs penprint.mjs with the flags it needs (Node >= 22.15, no npm install required).
D="$(cd "$(dirname "$0")" && pwd)"
exec node --import "$D/register.mjs" --experimental-strip-types --no-warnings "$D/penprint.mjs" "$@"
