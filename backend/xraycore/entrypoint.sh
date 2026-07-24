#!/bin/sh
set -eu

: "${CONFIG:?CONFIG env is required}"

printf '%s\n' "$CONFIG" > /tmp/xray/config.json

/app/xray/xray run -c /tmp/xray/config.json