#!/usr/bin/env bash
set -euo pipefail

DEMO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$DEMO")"
cd "$DEMO"

rm -rf laravel
composer create-project 'laravel/laravel:^13' laravel --no-interaction --prefer-dist
cd laravel

composer config repositories.precognition-plus path ../..
composer require 'codenyra/precognition-plus:@dev' 'inertiajs/inertia-laravel:^3.0' --no-interaction

(cd "$ROOT/js" && npm ci && npm run build)
echo 'install-links=true' >> .npmrc
npm install '@inertiajs/vue3@^3.11' 'vue@^3.5' '@vitejs/plugin-vue@^6' 'precognition-plus@file:../../js'

cp -R "$DEMO/files/." .

php artisan db:seed --force --no-interaction
npm run build

echo
echo "Ready. Start it with: cd demo/laravel && php artisan serve"
