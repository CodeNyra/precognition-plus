# Your own rules

Precognition Plus runs [a list of Laravel's rules](rules.md) in the browser,
and you can add to that list the same way the package adds its own. Each rule
has two halves under one name. A PHP class says when the rule can go to the
browser, and you list it in `config/precognition-plus.php`. A JavaScript check
answers the way the rule does, and you list it where you call
`setupPrecognitionPlus()`. Laravel still runs the rule on the server when the
form is submitted.

You can add three kinds of rules:

- one of Laravel's rules that Precognition Plus doesn't run yet, like `date_format`;
- a named rule of your own, from `Validator::extend()`;
- a rule class of your own, from `php artisan make:rule`.

## Setting up

Publish the config file once.

```bash
php artisan vendor:publish --tag=precognition-plus-config
```

Keep the browser halves together, the way the package does, with one file per
rule and a list that imports them.

```
resources/js/
├── app.ts
├── browser_rules.ts
└── rules/
    ├── date_format.ts
    └── iso_date.ts
```

```ts
// resources/js/browser_rules.ts
import type { RuleValidators } from 'precognition-plus'
import { date_format } from './rules/date_format'
import { iso_date } from './rules/iso_date'

// The browser halves by rule name. Keep in step with config/precognition-plus.php.
export const browserRules: RuleValidators = {
  date_format,
  iso_date,
}
```

```ts
// resources/js/app.ts
import { setupPrecognitionPlus } from 'precognition-plus'
import { browserRules } from './browser_rules'

setupPrecognitionPlus({ rules: browserRules })
```

## One of Laravel's rules

Say your forms use `date_format:Y-m-d`.

```php
'birthday' => ['required', 'date_format:Y-m-d'],
```

The PHP half sends that format to the browser and leaves any other to the
server, the way the package's own `Rules/Email.php` leaves `email:dns` there.

```php
// app/Browser/DateFormat.php
namespace App\Browser;

use CodeNyra\PrecognitionPlus\BrowserRule;
use CodeNyra\PrecognitionPlus\Schema\Field;

final class DateFormat extends BrowserRule
{
    public function parameters(array $parameters, Field $field): ?array
    {
        return $parameters === ['Y-m-d'] ? $parameters : null;
    }
}
```

```php
// config/precognition-plus.php
'rules' => [
    'date_format' => App\Browser\DateFormat::class,
],
```

Laravel checks the format by reading the date and writing it back, so a date
passes when the day exists and it's written the same way. The browser half
does the same for four-digit years, and leaves odd ones like `10000` to the
server.

```ts
// resources/js/rules/date_format.ts
import { askServer, type RuleValidator } from 'precognition-plus'

export const date_format: RuleValidator = (value) => {
  // Laravel takes text or numbers, and a number never matches Y-m-d.
  if (typeof value !== 'string') return false
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!date) return /^-?\d+-\d{2}-\d{2}$/.test(value) ? askServer() : false
  const [year, month, day] = date.slice(1).map(Number)
  const parsed = new Date(0)
  parsed.setUTCFullYear(year, month - 1, day)
  return parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
}
```

The browser shows Laravel's own message for `date_format`, from your
translations.

## A named rule of your own

This rule takes a date written as `yyyy-mm-dd`, and only a day that exists.

```php
// app/Providers/AppServiceProvider.php, in boot()
Validator::extend('iso_date', fn (string $attribute, mixed $value) => is_string($value)
    && preg_match('/^(\d{4})-(\d{2})-(\d{2})\z/', $value, $date)
    && checkdate((int) $date[2], (int) $date[3], (int) $date[1]));
```

```php
// lang/en/validation.php
'iso_date' => 'The :attribute field must be a date like 2024-12-31.',
```

```php
'birthday' => ['required', 'iso_date'],
```

It always goes to the browser as it is, so `BrowserRule` itself is its PHP
half.

```php
// config/precognition-plus.php
'rules' => [
    'iso_date' => CodeNyra\PrecognitionPlus\BrowserRule::class,
],
```

```ts
// resources/js/rules/iso_date.ts
import type { RuleValidator } from 'precognition-plus'

export const iso_date: RuleValidator = (value) => {
  const date = typeof value === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null
  if (!date) return false
  const [year, month, day] = date.slice(1).map(Number)
  const parsed = new Date(0)
  parsed.setUTCFullYear(year, month - 1, day)
  // checkdate() starts at year 1, so 0000 fails here too.
  return year >= 1 && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
}
```

A named rule's parameters, like the `2000` in `iso_date:2000`, reach the check
as strings in `rule.params`.

## A rule class of your own

Here is the same rule as a class.

```php
// app/Rules/IsoDate.php
namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class IsoDate implements ValidationRule
{
    public const MESSAGE = 'The :attribute field must be a date like 2024-12-31.';

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value)
            || ! preg_match('/^(\d{4})-(\d{2})-(\d{2})\z/', $value, $date)
            || ! checkdate((int) $date[2], (int) $date[3], (int) $date[1])) {
            $fail(self::MESSAGE);
        }
    }
}
```

```php
'birthday' => ['required', new IsoDate],
```

Laravel only learns a rule class's message when `validate()` calls `$fail()`,
and the class has no name for the browser to list its check under, so its PHP
half gives both. With the message in a constant, it's still written once.

```php
// app/Browser/IsoDate.php
namespace App\Browser;

use App\Rules\IsoDate as Rule;
use CodeNyra\PrecognitionPlus\BrowserRule;

final class IsoDate extends BrowserRule
{
    public function name(): ?string
    {
        return 'iso_date';
    }

    public function message(): ?string
    {
        return Rule::MESSAGE;
    }
}
```

Rule classes are listed by class.

```php
// config/precognition-plus.php
'rules' => [
    App\Rules\IsoDate::class => App\Browser\IsoDate::class,
],
```

The browser half is the `iso_date` check from the section above.

### Options

When a rule class takes options, its PHP half gets the rule in its constructor
and sends them as parameters.

```php
// app/Rules/IsoDate.php
public function __construct(public readonly int $from = 1) {}

// validate() also fails when (int) $date[1] < $this->from.
```

```php
// app/Browser/IsoDate.php
public function __construct(private readonly Rule $rule) {}

public function parameters(array $parameters, Field $field): ?array
{
    return [(string) $this->rule->from];
}
```

The check reads the year from `rule.params`, and still starts at year 1.

```ts
// resources/js/rules/iso_date.ts
export const iso_date: RuleValidator = (value, rule) => {
  const from = Math.max(1, Number(rule.params[0] ?? 1))
  // The rest as above, ending with
  return year >= from && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
}
```

## Turning off or replacing a built-in rule

An entry set to `null` keeps a built-in rule on the server.

```php
'rules' => [
    'email' => null,
],
```

An entry with a built-in rule's name replaces it, and so does a check with the
same name in `browser_rules.ts`. Your check then runs for every use of that
rule, so it has to answer exactly like Laravel.

## What a check gets

A check gets the field's value, the rule and a context.

- `value` is the value as your PHP rule gets it, so text is trimmed and an
  empty field is `null`. Like Laravel, the browser skips the rule when the
  field is missing, or empty in a `nullable` field.
- `rule.params` holds the parameters as strings, and `rule.message` the
  message.
- `context.field` has the field's size type, like `numeric`, and whether it's
  nullable. `context.other(path)` reads another field, for Laravel rules that
  name one, like `same:password`.

Return `true` when the value passes and `false` when it fails. When you can't
be sure, return `askServer()`, and the server decides. Throwing, or returning
anything else, does the same. A check has to answer right away, so it can't
wait for a request.

## Messages

The browser shows the message Laravel would.

- A named rule's message is Laravel's for that name, from `messages()`, your
  lang files or `Validator::extend()`'s third argument. A `Validator::replacer()`
  for the rule fills it in too. It runs without the request's data, so a
  replacer that reads the data breaks the form's browser rules, and the error
  is reported.
- A rule class's message is the one its PHP half gives, unless `messages()` has
  one under the class name or a key like `birthday.iso_date`, which wins, as in
  Laravel. If your rule translates its message, like
  `$fail('validation.iso_date')->translate()`, return `__('validation.iso_date')`.
- A rule whose message uses `:input` stays on the server, since only the
  request has the value.

## What stays on the server

The field's other browser rules still run in the browser, while these stay on
the server.

- A rule whose PHP half returns `null` from `parameters()`, and a rule class
  whose PHP half has no `name()` or `message()`.
- Rules Laravel runs on empty fields, like `required_with`, `filled` or a rule
  class with `$implicit = true`, apart from `required`, `accepted` and
  `declined`.
- Your own rules that read other fields, from `DataAwareRule`,
  `ValidatorAwareRule` or `Validator::extendDependent()`.
- Parameters that aren't a list of strings, and messages with `:input`.
- Everything in [what always goes to the server](rules.md#what-always-goes-to-the-server),
  and fields named in `#[ServerOnly]`.

Closures always run on the server.

## Keeping both halves in step

Precognition Plus checks that its own rules answer like Laravel on every
release it supports. It can't do that for yours, so test both halves with the
same values, edge cases included. The `iso_date` check above rejects
`0000-01-01` only because PHP's `checkdate()` does.

If the halves disagree, the browser shows the wrong message, or none, while
someone types. It can't let bad data in, since submitting still runs every rule
on the server. If one half ships without the other, like the PHP half with an
old cached bundle, the browser doesn't know the rule and asks the server.

## What the browser sees

Your rules reach the browser like the built-in ones, with their names,
parameters and messages. To keep a field's rules private, name it in
`#[ServerOnly]`.
