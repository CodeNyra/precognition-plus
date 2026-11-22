# Rules

These rules run in the browser, and [you can add your own](custom-rules.md).
Every other rule, like `unique`, `exists`, `date`, `array` or a closure, runs
on the server. A field with both kinds is checked in the browser first, and
only sent to the server once its browser rules pass.

| Rule | Notes |
|---|---|
| `accepted`, `declined` | Also checked on an empty field. |
| `alpha`, `alpha_dash`, `alpha_num` | ASCII text, or any text with `:ascii`. |
| `bail`, `nullable`, `sometimes` | |
| `between`, `min`, `max`, `size` | Characters for text, the value for a numeric field, items for a list. Not for files. |
| `boolean`, `integer`, `numeric`, `string` | Without `:strict`. |
| `confirmed` | Compares with `<field>_confirmation`, or the field it names. |
| `decimal`, `digits`, `digits_between`, `min_digits`, `max_digits` | |
| `email` | Plain `email` and `email:rfc`, for plain addresses. |
| `enum` | `Rule::enum()` with a backed enum of up to 1,000 cases. |
| `in`, `not_in` | Also `Rule::in()` and `Rule::notIn()`, with up to 1,000 values. |
| `lowercase`, `uppercase` | ASCII text. |
| `regex`, `not_regex` | Patterns PHP and JavaScript read the same way, see below. |
| `required` | |
| `starts_with`, `ends_with`, `doesnt_start_with`, `doesnt_end_with` | Text. |
| `ulid`, `uuid` | `uuid` without a version. |

Whenever the browser can't be sure it would answer like Laravel, it asks the
server. That covers `true` or a list in a text rule, a fraction sent as a
number rather than a string, a number with an exponent, text over 100,000
characters, and a failing value that a rule running after it might throw on.

## What always goes to the server

- fields written with `*`, and any field under a top-level name that has a `*`
  key, like `items.note` next to `items.*.sku`;
- any field under a top-level name with a rule that may skip, like
  `exclude_if` or `Rule::when()`, and any field whose rules read one of those;
- fields that compare dates, like `after:today` or `before:end_date`, since
  Laravel resolves dates when the request comes in;
- rules whose message shows the value with `:input`, and rules with your own
  replacer or check from `Validator::replacer()` or `Validator::extend()`;
- fields with an escaped dot in their name, like `a\.b`, and fields that
  aren't in the FormRequest.

## Regular expressions

A `regex` runs in the browser when PHP and JavaScript read it the same way.
That means printable ASCII with no flags, or only `i` and `s`, made of
characters, escapes like `\d`, `\w` and `\s`, classes, groups, lookaheads,
anchors and quantifiers, with at most two quantifiers or alternations and no
repeated group. A value with characters beyond ASCII, a `\r`, a trailing line
break, or more than 255 characters goes to the server.

## Messages

Messages are built on the server from your translations, `messages()` and
`attributes()`, so each one is exactly what Laravel would show for that rule.

## What the browser sees

Anyone past a FormRequest's `authorize()` gets each field's name and size type,
like `numeric` or `file`, whether it's nullable, has `sometimes` or has server
rules, its browser rules with their parameters and messages, and the names of
the fields its server rules read. Server rules and their parameters aren't
sent, and neither are the rules of fields named in `#[ServerOnly]`.
