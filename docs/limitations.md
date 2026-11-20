# Limitations and troubleshooting

## Known limitations

- The first validation of each form waits for the server, as with plain
  Precognition, because that request brings the rules.
- For fields checked only in the browser, code that branches on
  `$request->isPrecognitive()` doesn't run until the form is submitted.
- Server answers are reused. A server field is sent again only when its own
  value or a field its rules name (`type` in `required_if:type,business`)
  changes. A closure or Rule object that reads another field
  (`$this->country`, say) can show a stale result until its own field changes
  or the form is submitted.
- Rules picked with PHP from other input (`$this->input('type') === ...`) are
  learned once, from the form's first request. Write them as Laravel rules
  such as `required_if` instead (see
  [the usage guide](usage.md#rules-that-depend-on-other-fields)).
- The browser's `email` check is lenient on purpose and never blocks an
  address the server accepts, so a few addresses pass in the browser and fail
  on submit.
- Anything outside Precognition that watches precognitive responses (logging,
  monitoring) sees the first request of each form as a `200` with a JSON body
  instead of a `204`.
- Only FormRequests are covered. Validation written in the controller
  (`$request->validate([...])`) works as plain Precognition, without rules in
  the browser.
- If npm installs a second copy of `laravel-precognition` (the old
  `laravel-precognition-vue-inertia` 0.x pins its own, for example), forms
  that use that copy aren't covered.

## Troubleshooting

### The response has no rules

Look at the first precognitive request of the form on the Network tab:

| What you see | Why, and what to do |
|---|---|
| No `Precognition-Rules` header in the request | The browser side isn't running. Check that `setupPrecognitionPlus()` is called before the app starts, and that `npm ls laravel-precognition` lists one copy. |
| The header is there, the answer is a `204` | The server side isn't adding the rules. Check that `codenyra/precognition-plus` is installed (`composer show codenyra/precognition-plus`), that `PRECOGNITION_PLUS_ENABLED` isn't `false`, and that the route validates with a FormRequest. Run `php artisan config:clear` if the config is cached. |
| The header is there, the answer is a `403`, a redirect or a `500` | Only `204` and `422` answers get rules. Fix what Laravel answered first; `authorize()` returning `false` gives the `403`. |
| The request fails with a CORS error | Your API is on another origin and doesn't allow the `Precognition-Rules` header. Add it to `allowed_headers` in `config/cors.php`. |
| A `422` without `rules` | Look in your log: an error while building the rules is reported there, and the response goes out without them. |

### A field always goes to the server

Check its rules against [the list](rules.md). Common reasons:

- it has a rule the browser doesn't run, such as `unique`, a Rule object or a
  closure, and its browser rules pass, so the server has to answer;
- it isn't in the FormRequest's rules at all, which is usually the case for
  `password_confirmation` (see [the usage guide](usage.md#password-confirmation));
- it is an array field written with `*`;
- its `regex` uses a flag or syntax only PHP has, such as `[[:alpha:]]` or
  `\h`.

### A message differs from the server's

Every message is built on the server, except that the browser fills in
`:input` the way Laravel does, so this shouldn't happen. If you see it,
please open an issue with the rule and the value.

## Reporting a problem

Issues go to [GitHub](https://github.com/codenyra/precognition-plus/issues).
The rules of the FormRequest, the request and response from the Network tab,
and your versions of Laravel, Inertia and `laravel-precognition` help most.
