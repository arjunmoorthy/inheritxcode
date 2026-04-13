#!/bin/sh
set -eu

TARGET_CONF="/etc/nginx/conf.d/default.conf"
DEFAULT_CERT_DIR="/etc/letsencrypt/live/patient.healthai.global"
ALT_CERT_DIR="/etc/letsencrypt/live/healthai.global"

if [ -f "$DEFAULT_CERT_DIR/fullchain.pem" ] && [ -f "$DEFAULT_CERT_DIR/privkey.pem" ]; then
    sed "s#/etc/letsencrypt/live/healthai.global#$DEFAULT_CERT_DIR#g" /etc/nginx/custom/https.conf > "$TARGET_CONF"
    echo "Using HTTPS nginx config with certificate from $DEFAULT_CERT_DIR"
elif [ -f "$ALT_CERT_DIR/fullchain.pem" ] && [ -f "$ALT_CERT_DIR/privkey.pem" ]; then
    cp /etc/nginx/custom/https.conf "$TARGET_CONF"
    echo "Using HTTPS nginx config with certificate from $ALT_CERT_DIR"
else
    cp /etc/nginx/custom/http.conf "$TARGET_CONF"
    echo "Using HTTP bootstrap nginx config because no shared healthai certificate was found"
fi

exec nginx -g 'daemon off;'
