# Installation

## Requirements

| | |
|---|---|
| PHP | 8.2 or newer |
| Laravel | 12 or 13 |
| Front end | `laravel-precognition` 2.x. Inertia 3's `@inertiajs/vue3`, `@inertiajs/react` and `@inertiajs/svelte` include it. |

Your app should already use Precognition: routes with the
`HandlePrecognitiveRequests` middleware and forms that call `validate()`. If
it doesn't yet, set that up first with the
[Laravel Precognition docs](https://laravel.com/docs/precognition).

## Install both packages

```bash
composer require codenyra/precognition-plus
npm install precognition-plus
```

The Composer package registers itself, so there is no middleware to add and
no config you have to publish.

## Start it in the browser

Call `setupPrecognitionPlus()` once, in the file that starts your app, before
any form is created:

```ts
// resources/js/app.ts
import { setupPrecognitionPlus } from 'precognition-plus'

setupPrecognitionPlus()
```

FormRequests, controllers, components and routes stay as they are.

`setupPrecognitionPlus()` returns a function that removes it again, which is
only useful in tests or for a switch like the one in the demo:

```ts
const uninstall = setupPrecognitionPlus()
uninstall() // plain Precognition from here on
```

## An API on another domain

The first precognitive request of each form carries an extra
`Precognition-Rules` header. If that request goes to another origin and your
`config/cors.php` lists `allowed_headers` by name instead of `['*']`, add
`Precognition-Rules` to the list, or the browser blocks the request.

## Check that it works

Open your browser's developer tools on the Network tab and validate a field
of a form:

1. The first precognitive request carries a `Precognition-Rules: true` header,
   and its response has a `rules` object in its body. A successful first
   request answers `200` rather than Precognition's usual `204`.
2. After that, fields that have only [browser rules](rules.md) make no
   request at all, and fields with server rules are sent alone, in
   `Precognition-Validate-Only`.

If the first response has no `rules`, see
[Limitations and troubleshooting](limitations.md#the-response-has-no-rules).

## Turning it off

Set this in `.env` to turn it off everywhere:

```ini
PRECOGNITION_PLUS_ENABLED=false
```

Laravel then answers like plain Precognition, and the browser does the same,
because it only checks locally when the server sent rules. To change the
setting in a config file instead, publish it:

```bash
php artisan vendor:publish --tag=precognition-plus-config
```

## Removing it

Remove the `setupPrecognitionPlus()` call, then both packages:

```bash
npm uninstall precognition-plus
composer remove codenyra/precognition-plus
```

Nothing else refers to them, so forms go back to plain Precognition.
