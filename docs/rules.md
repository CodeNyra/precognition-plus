# Rules

## Checked in the browser

| Rule | Notes |
|---|---|
| `required` | |
| `string` | |
| `numeric` | |
| `integer` | Not `integer:strict`, which goes to the server. |
| `boolean` | Not `boolean:strict`, which goes to the server. |
| `min`, `max`, `between` | Measured like Laravel: characters for strings, the value for numeric fields (with `numeric` or `integer`), items for arrays, and kilobytes for files. |
| `email` | Plain `email` and `email:rfc`. Lenient on purpose, so the browser never rejects an address the server accepts. Other variants (`dns`, `spoof`, `strict`, `filter`) go to the server. |
| `regex` | With flags `i`, `m`, `s` or `u`, when JavaScript reads the pattern the same way. `\A`, `\z` and `\Z` are converted. Syntax only PHP has, such as POSIX classes (`[[:digit:]]`), `\h`, `\K`, or `\p{...}` without the `u` flag, goes to the server, as do other flags. |
| `in` | Also `Rule::in([...])`. |
| `confirmed` | Compares with `<field>_confirmation`, or the field named in `confirmed:<field>`. |

These change how the others apply, and are understood too:

| Modifier | |
|---|---|
| `nullable` | An empty field skips the other rules. |
| `sometimes` | Accepted. A form's fields are always in its data, so it skips nothing there. |
| `bail` | Accepted. The browser shows one message per field either way. |

## Sent to the server

Everything else, for example:

- `unique`, `exists`, and any other rule that reads the database;
- Rule objects (`new ValidCoupon`, `Rule::unique(...)`, `Password::defaults()`) and closures;
- rules that look at other fields or files, like `required_if`, `same`, `different`, `after`, `image` and `mimes`;
- `size`, `date`, `url`, `alpha_dash` and the other string and number rules not in the table above;
- fields of arrays, written with `*` (`items.*.sku`);
- fields that aren't in the FormRequest's rules at all.

A field can mix both kinds. Its browser rules are checked first, and the
field is sent to the server only when they pass. See
[the usage guide](usage.md#a-formrequest) for the three groups this gives.
When a server rule names another field, like `required_if:type,business`, the
field is also sent again whenever that other field changes.

## Values

Before checking, the browser treats values the way Laravel's default
middleware does: strings are trimmed (`TrimStrings`) and empty strings become
`null` (`ConvertEmptyStringsToNull`), so `required` and `nullable` behave
the same on both sides.

## Messages

Every message is built on the server and sent with the rules, so the browser
shows what Laravel would. That includes your `lang/` files, the FormRequest's
`messages()` and `attributes()`, and the right size variant (`The name field
must not be greater than 20 characters.` for a string, `... greater than 20.`
for a number). Only `:input` is filled in by the browser, with the current
value shown the way Laravel would show it, including names from
`validation.values`.

## What the browser sees

The rules sent to the browser include their parameters, such as `in` lists,
`regex` patterns and size limits, and anyone who passes the FormRequest's
`authorize()` can read them. Server rules are never sent. To keep a list or a
pattern private, check it with a server rule instead (see
[Keeping a rule private](usage.md#keeping-a-rule-private)).
