# Rules

A rule runs in the browser when the field's own value is enough to check
it. Rules that need the database, another field, the file's content or PHP's
date parsing go to the server. Of the 112 rules in Laravel 13, 38 run in the
browser, counting `nullable`, `sometimes` and `bail`, and so does
`Rule::enum()`.

A field can mix both kinds. Its browser rules are checked first, and the
field is sent to the server only when they pass. See
[the usage guide](usage.md#a-formrequest) for the three groups this gives.
When a server rule names another field, like `required_if:type,business`, the
field is also sent again whenever that other field changes.

Where Laravel releases answer a value differently, the browser leaves the
field to the server, which answers the way its own release does. A few
differences are still open, listed in
[Limitations](limitations.md#known-limitations). The submit always runs every
rule on the server.

## Every rule

The rules are grouped the way the
[Laravel docs](https://laravel.com/docs/validation#available-validation-rules)
group them, and each is listed once.

### Booleans

| Rule | Runs in | Notes |
|---|---|---|
| `accepted` | Browser | Checked on an empty field too, like `required`. |
| `accepted_if` | Server | Reads another field. |
| `boolean` | Browser | `boolean:strict` goes to the server. |
| `declined` | Browser | Checked on an empty field too. |
| `declined_if` | Server | Reads another field. |

### Strings

| Rule | Runs in | Notes |
|---|---|---|
| `active_url` | Server | Looks the host up in DNS. |
| `alpha`, `alpha_dash`, `alpha_num` | Browser | Also with `:ascii`. |
| `ascii` | Server | Not in the browser yet. |
| `base64` | Server | Laravel 13. Not in the browser yet. |
| `confirmed` | Browser | Compares with `<field>_confirmation`, or the field named in `confirmed:<field>`, the way PHP's `===` compares, lists and objects included. |
| `current_password` | Server | Needs the signed-in user. |
| `different`, `same` | Server | Read another field. |
| `email` | Browser | Plain `email` and `email:rfc`, checked leniently so the browser never rejects an address the server accepts. `dns`, `spoof`, `strict` and `filter` go to the server. |
| `enum` | Browser | `Rule::enum()`. The enum's values, and whether it is backed by integers or strings, are sent to the browser, which reads the value the way `tryFrom()` does. A pure enum goes to the server. |
| `hex_color` | Server | Not in the browser yet. |
| `in`, `not_in` | Browser | Also `Rule::in()` and `Rule::notIn()`. With the `array` rule, each item of a list is checked, as in Laravel. A value that only a loose comparison matches, like `01` for `1`, goes to the server, because Laravel compares loosely before 12.67 and 13.26 and exactly after. |
| `ip`, `ipv4`, `ipv6` | Server | Not in the browser yet. |
| `json` | Server | Not in the browser yet. |
| `lowercase`, `uppercase` | Browser | A list goes to the server, since releases before 13.4 throw an error for it. |
| `mac_address` | Server | Not in the browser yet. |
| `min`, `max`, `size` | Browser | Measured like Laravel: characters for strings, the value for numeric fields (with `numeric`, `integer` or `decimal`), items for arrays, and kilobytes for files. Compared exactly, as Laravel compares them. With a parameter that isn't a plain number, like `max:1e3`, they go to the server, and so do sizes of files with a parameter that isn't whole, like `max:0.5`. |
| `regex`, `not_regex` | Browser | When JavaScript reads the pattern the same way. See [Regular expressions](#regular-expressions). |
| `starts_with`, `ends_with`, `doesnt_start_with`, `doesnt_end_with` | Browser | Releases treat values that aren't text differently, so an empty field, a number or `true` goes to the server when they would disagree. |
| `string` | Browser | |
| `ulid` | Browser | |
| `url` | Server | Not in the browser yet. |
| `uuid` | Browser | Without a version. `uuid:4` and the like go to the server. |

### Numbers

| Rule | Runs in | Notes |
|---|---|---|
| `between` | Browser | Measured like `min` and `max`. |
| `decimal` | Browser | |
| `digits`, `digits_between`, `min_digits`, `max_digits` | Browser | Up to 13.3 (13.5 for `digits_between`), the digit counts read an empty field or `true` as text, so those go to the server when releases would disagree. |
| `gt`, `gte`, `lt`, `lte` | Server | Not in the browser yet. With a field name as their parameter, they read another field. |
| `integer` | Browser | `integer:strict` goes to the server. |
| `multiple_of` | Server | Not in the browser yet. |
| `numeric` | Browser | `numeric:strict` goes to the server. |

### Arrays

| Rule | Runs in | Notes |
|---|---|---|
| `array` | Server | Not in the browser yet. The field's `min`, `max`, `size` and `in` still run in the browser first. |
| `array_keys` | Server | Laravel 13. Not in the browser yet. |
| `contains`, `doesnt_contain` | Server | Not in the browser yet. |
| `distinct` | Server | Used on `*` fields, which the browser skips. |
| `in_array` | Server | Reads another field. |
| `in_array_keys` | Server | Not in the browser yet. |
| `list` | Server | Not in the browser yet. |

### Dates

| Rule | Runs in | Notes |
|---|---|---|
| `after`, `after_or_equal`, `before`, `before_or_equal`, `date_equals` | Server | PHP reads dates in formats JavaScript doesn't, like `tomorrow` or `+1 week`, in the server's time zone. With a field name as their parameter, they read another field. |
| `date`, `date_format` | Server | PHP's date parsing, as above. |
| `timezone` | Server | Checked against PHP's list of time zones. |

### Files

| Rule | Runs in | Notes |
|---|---|---|
| `dimensions` | Server | Reads the image. |
| `encoding` | Server | Reads the bytes of the file or string. |
| `extensions` | Browser | The extension of the file's name, read the way Laravel reads it. As in Laravel, PHP files fail unless `php` is in the list. |
| `file` | Browser | |
| `image`, `mimes`, `mimetypes` | Server | Read the file's content. |

### Database

| Rule | Runs in | Notes |
|---|---|---|
| `exists`, `unique` | Server | Read the database. |

### Utilities

| Rule | Runs in | Notes |
|---|---|---|
| `any_of` | Server | `Rule::anyOf()`. |
| `bail` | Browser | Accepted. The browser shows one message per field either way. |
| `exclude` | Server | Not in the browser yet. |
| `exclude_if`, `exclude_unless`, `exclude_with`, `exclude_without` | Server | Read another field. |
| `filled`, `missing`, `present`, `prohibited` | Server | Not in the browser yet. |
| `missing_if`, `missing_unless`, `missing_with`, `missing_with_all` | Server | Read another field. |
| `nullable` | Browser | An empty field skips the other rules. |
| `present_if`, `present_unless`, `present_with`, `present_with_all` | Server | Read another field. |
| `prohibited_if`, `prohibited_if_accepted`, `prohibited_if_declined`, `prohibited_unless`, `prohibits` | Server | Read another field. |
| `required` | Browser | |
| `required_array_keys` | Server | Not in the browser yet. |
| `required_if`, `required_if_accepted`, `required_if_declined`, `required_unless`, `required_with`, `required_with_all`, `required_without`, `required_without_all` | Server | Read another field. |
| `sometimes` | Browser | Accepted. A form's fields are always in its data, so it skips nothing there. |

Fields of arrays, written with `*` (`items.*.sku`), and fields that aren't in
the FormRequest's rules at all always go to the server.

## Rule objects

Rule objects that stand for plain rules are read as those rules:

| Object | Read as |
|---|---|
| `Rule::in()`, `Rule::notIn()` | `in`, `not_in` |
| `Rule::enum()` | The enum's values, after `only()` and `except()` |
| `Rule::string()`, `Rule::numeric()` | The rules they hold, so `Rule::string()->max(255)` is `string\|max:255` |
| `Rule::regex()`, `Rule::notRegex()` | `regex`, `not_regex` (Laravel 13) |
| `Rule::confirmed()`, `Rule::requiredWith()` and the other rule objects Laravel 13 added | The rule they name |
| `Rule::array()`, `Rule::date()`, `Rule::ip()`, `Rule::contains()`, `Rule::doesntContain()`, `Rule::arrayKeys()` | Their rules, which go to the server |

Any other object goes to the server, and its parameters are never sent:

- closures and Rule classes of your own;
- `Password`, `File` and `Rule::email()`, which run code of their own;
- `Rule::exists()`, `Rule::unique()`, `Rule::can()`, `Rule::dimensions()` and
  `Rule::anyOf()`;
- `Rule::requiredIf()`, `Rule::prohibitedIf()`, `Rule::excludeIf()`, their
  `Unless` versions and `Rule::when()`. They depend on a condition, and the
  browser would keep the answer from the form's first request.

## Regular expressions

`regex` and `not_regex` run in the browser with the flags `i`, `m`, `s` or
`u`, when the pattern means the same in JavaScript. The server first checks
that its PHP can compile the pattern, then rewrites what needs it. `\A`, `\z`
and `\Z` become `^` and `$`, and with the `u` flag PCRE's `\d` and `\s`, which
cover Unicode, are written out.

These patterns go to the server:

- ones PHP can't compile, like `(?<=a+)b`;
- POSIX classes like `[[:digit:]]`, and escapes only PCRE has, like `\h`, `\K`
  or `\x{...}`;
- `\w` and `\b` with the `u` flag, and `\p{...}` with the `i` flag, because
  what they match changed between PCRE releases;
- `\p{...}` without the `u` flag, and quantifiers like `{,3}`, which PCRE
  releases read differently;
- flags other than `i`, `m`, `s` and `u`.

The browser also asks the server about text PHP reads differently: text
beyond ASCII without the `u` flag, because PHP then matches bytes, or with
both `u` and `i`, because PHP's case folding isn't JavaScript's; text with
`\r`, U+2028 or U+2029, which aren't line breaks to PHP; and text that ends
with a line break, before which PHP's `$` also matches. Only a field that
`TrimStrings` leaves alone, like `password`, can end with a line break.

## Values

Before checking, the browser treats values the way Laravel's default
middleware does: strings are trimmed (`TrimStrings`) and empty strings become
`null` (`ConvertEmptyStringsToNull`), inside arrays too, so `required` and
`nullable` behave the same on both sides.

It trims the same characters as Laravel's `Str::trim()`: whitespace, NUL, and
the invisible characters in `Str::INVISIBLE_CHARACTERS`, such as the
zero-width space, the byte order mark and the soft hyphen.

`password` and the other fields `TrimStrings` leaves alone can hold only
spaces. Laravel then runs only `required`, `accepted` and `declined` on them,
and so does the browser.

A number from a number input reaches Laravel the way JSON writes it. A whole
number arrives as an integer and is checked in the browser. A fraction, like
`9.99`, or a number beyond 64 bits arrives as a float, which PHP writes as
text with its `precision` setting. So rules that read it as text or compare
it, like `regex`, `integer`, `decimal` or `max`, leave it to the server.
Numbers typed as text are compared exactly in the browser, except ones
written with an exponent, like `1e5`, which go to the server.

## Messages

Every message is built on the server and sent with the rules, so the browser
shows what Laravel would. That includes your `lang/` files, the FormRequest's
`messages()` and `attributes()`, and the right size variant (`The name field
must not be greater than 20 characters.` for a string, `... greater than 20.`
for a number). Only `:input` is filled in by the browser, with the current
value shown the way Laravel would show it, including names from
`validation.values`.

## What the browser sees

The rules sent to the browser include their parameters, such as `in` and
`not_in` lists, enum values, `regex` patterns, `starts_with` prefixes and size
limits, and anyone who passes the FormRequest's `authorize()` can read them.
Server rules are never sent. To keep a list or a pattern private, check it
with a server rule instead (see
[Keeping a rule private](usage.md#keeping-a-rule-private)).
