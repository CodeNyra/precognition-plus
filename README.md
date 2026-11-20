# Precognition Plus

Precognition Plus checks the simple rules of your FormRequests in the browser, so a Laravel Precognition form only calls the server for the fields that need it. Rules like `required`, `integer`, `max`, `regex`, `alpha_dash` and `Rule::enum()` run in the browser. A field with a rule the browser can't run, such as `unique`, `exists`, a closure or a Rule class of your own, still goes to the server, on its own and only after its value changed.

| | |
|---|---|
| Composer | `codenyra/precognition-plus` (namespace `CodeNyra\PrecognitionPlus\`) |
| npm | `precognition-plus` |
| Requires | PHP 8.2+, Laravel 12.53+ or 13, `laravel-precognition` 2.x (Inertia 3's `@inertiajs/vue3`, `react` and `svelte` already include it) |

You need both packages. With only one of them, forms work like plain Precognition.

## Setup

```bash
composer require codenyra/precognition-plus
npm install precognition-plus
```

```ts
// resources/js/app.ts
import { setupPrecognitionPlus } from 'precognition-plus'

setupPrecognitionPlus()
```

FormRequests, controllers, components and the `HandlePrecognitiveRequests` middleware on your routes stay the way the Precognition docs describe them.

## How it works, in short

1. The first validation of a form goes to the server as usual. Its response also brings back the FormRequest's browser rules, with Laravel's own messages.
2. After that, browser rules are checked in the browser. Fields with server rules are sent on their own, and only when their value, or a field their rules name, changed.
3. Submitting the form runs full validation on the server, as before.

A form never makes more requests than it would with plain Precognition.

## The browser can read the rules

Anyone who passes the FormRequest's `authorize()` gets its browser rules, parameters included, so `in` and `not_in` lists, enum values and `regex` patterns are public. `Rule::in(Coupon::pluck('code'))` would show every coupon code to whoever opens the form. Check a list like that with `Rule::exists()`, a closure or a Rule class of your own instead; those never leave the server.

## Documentation

- [Installation](docs/installation.md)
- [Usage guide](docs/usage.md)
- [Rules](docs/rules.md), every Laravel rule and where it runs
- [How it works](docs/how-it-works.md)
- [Limitations and troubleshooting](docs/limitations.md)

The [live demo](https://precognition.codenyra.com) is a signup form with browser, mixed and server-only fields, and a log of every check. To run it yourself, see [`demo/`](demo).

## Development

```bash
composer install && composer test                           # PHP: schema building, precognitive responses
cd js && npm install && npm test                            # JS: rules, interceptor with stock Inertia Vue/React forms
npm run typecheck && npm run build
```

| Folder | What |
|---|---|
| `php/` | The Composer package (`src/`, `config/`) and its tests. `composer.json` stays at the root, where Packagist reads it. |
| `js/` | The npm package, with its own `package.json` and tests. |
| `docs/` | The documentation. |
| `demo/` | The demo's files, and `setup.sh`, which builds a fresh Laravel app with them. |
