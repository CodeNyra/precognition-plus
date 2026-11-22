# Limitations and troubleshooting

## Limitations

- A form's first validation waits for the server, since its response brings
  the rules.
- Server answers are reused until the field, or a field its rules name,
  changes, or until an Inertia visit finishes. Until then, a closure or a Rule
  class that reads another field can show a stale answer, and so can a submit
  sent some other way, like with `useHttp()`.
- Rules chosen in PHP from other input, like
  `$this->input('type') === 'business'`, are learned from the first request
  only. Use rules like `required_if` instead.
- A FormRequest gets no rules if it overrides a method that changes its input
  or validation, like `prepareForValidation()`, `validationData()` or `all()`,
  or if it has `validator()`, `withValidator()`, `after()` or
  `$stopOnFirstFailure`. Overriding `messages()`, `attributes()`,
  `passedValidation()`, `failedValidation()`, `failedAuthorization()` or the
  constructor is fine. Replacing Laravel's validator factory or resolver turns
  the rules off for every form.
- A FormRequest with more than 500 fields, or with rules over 1 MB, gets no
  rules.
- GET and DELETE forms, data with a file or `FormData`, and requests with
  `params`, `data`, `url`, `baseURL`, `method` or a `Content-Type` in their
  config work as plain Precognition.
- The browser assumes Laravel's default `TrimStrings` and
  `ConvertEmptyStringsToNull`, PHP's 8 MB `post_max_size`, and
  laravel-precognition's own HTTP client. It doesn't know about middleware of
  your own that changes the input, or client settings like axios interceptors,
  `withSerializer()` and `useHttpClient()`.
- The browser checks a field's browser rules before its server rules. So when
  a browser rule fails and an earlier server rule fails too, like `unique` or a
  rule whose message uses `:input`, the browser shows its own rule's message,
  while Laravel shows the first one in the list. The field is invalid either
  way.
- If `Lang::handleMissingKeysUsing()` sets a callback that returns something
  other than the key, Laravel's messages change, but the browser shows the
  ones built without it.
- With Inertia's `withAllErrors`, a field that fails in the browser only shows
  its first message.
- A field whose name has a comma, or characters outside ASCII, can't be
  validated on its own, since `Precognition-Validate-Only` can't carry it.
- Monitoring that watches responses sees a form's first request as a `200`
  with a body instead of a `204`.
- Every request with `Precognition-Rules: true` builds the rules, so rate limit
  precognitive requests like any others.

## Troubleshooting

A form's first precognitive request should carry `Precognition-Rules: true`,
and its response a `rules` object.

| What you see | What to check |
|---|---|
| No `Precognition-Rules` header | `setupPrecognitionPlus()` runs before the app starts, and `npm ls laravel-precognition` lists one copy. Requests that work as plain Precognition never send it. |
| The header, but no `rules` | The route uses `HandlePrecognitiveRequests` and a FormRequest, `PRECOGNITION_PLUS_ENABLED` isn't `false`, and none of the limitations above turns its rules off. Errors while building them go to your log. |
| A `403`, a redirect or a `500` | Only `204` and `422` responses get rules, so fix what Laravel returned first. |
| A CORS error | Add `Precognition-Rules` to `allowed_headers` in `config/cors.php`. |
| A field always goes to the server | See [the rules](rules.md) for what always goes to the server. |

Report a problem on
[GitHub](https://github.com/codenyra/precognition-plus/issues), with the
FormRequest's rules and the request and response from the Network tab.
