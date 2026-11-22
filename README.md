# Precognition Plus

Precognition Plus runs the simple rules of your FormRequests in the browser, so a Laravel Precognition form only asks the server about the fields that need it. Rules like `required`, `max`, `email`, `in` and `regex` are checked in the browser, while `unique`, `exists`, closures and the like still run on the server.

| | |
|---|---|
| Composer | `codenyra/precognition-plus` |
| npm | `precognition-plus` |
| Requires | PHP 8.2+, Laravel 12.53+ or 13, and `laravel-precognition` 2.1+ (Inertia 3 ships with it) |

## Setup

Your app should already be using [Laravel Precognition](https://laravel.com/docs/precognition). Install both packages.

```bash
composer require codenyra/precognition-plus
npm install precognition-plus
```

Then call `setupPrecognitionPlus()` once, before your app starts.

```ts
// resources/js/app.ts
import { setupPrecognitionPlus } from 'precognition-plus'

setupPrecognitionPlus()
```

From then on, every FormRequest on a route with `HandlePrecognitiveRequests` gets browser rules. Your FormRequests, controllers and forms don't change.

## How it works

1. A form's first validation request goes to the server as usual, and the response also carries the FormRequest's browser rules, with Laravel's own messages.
2. After that, browser rules run in the browser. A field with a server rule is sent on its own once its browser rules pass, and only if its value, or a field its rules read, has changed.
3. Submitting still runs every rule on the server, as before.

## Keeping rules private

Anyone who gets past a form's `authorize()` can see its browser rules, parameters included, like `in` lists, enum values and patterns. To keep a field's rules on the server, name it in `#[ServerOnly]` on the FormRequest, a parent class or a trait. The field is still validated, just only on the server, and so are the fields nested under it, like `coupon.code`. A `*` matches any key, so `#[ServerOnly('*')]` keeps all of a form's rules on the server.

```php
use CodeNyra\PrecognitionPlus\ServerOnly;

#[ServerOnly('coupon')]
class CheckoutRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'coupon' => ['nullable', Rule::in(Coupon::pluck('code'))], // checked on the server
            'plan' => ['required', Rule::in(['free', 'pro'])],         // checked in the browser
        ];
    }
}
```

Rules the browser doesn't run, like `Rule::exists()` or a closure, never leave the server anyway.

## More

Set `PRECOGNITION_PLUS_ENABLED=false` in `.env` to turn it off.

[The rules](docs/rules.md) list what runs in the browser, and [the limitations](docs/limitations.md) cover what doesn't, plus troubleshooting. [Your own rules](docs/custom-rules.md) shows how to add more, from Laravel's other rules to rule classes you write. The [live demo](https://precognition.codenyra.com) shows each kind of field, and [`demo/`](demo) runs it locally.

## Development

```bash
composer install && composer test
cd js && npm install && npm test && npm run typecheck && npm run build
```
