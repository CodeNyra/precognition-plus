# Changelog

## 0.3.1 (2026-11-22)

Apps can add rules of their own to the ones Precognition Plus runs in the
browser, the same way the package adds its own.
[docs/custom-rules.md](docs/custom-rules.md) walks through each kind.

- A `rules` list in `config/precognition-plus.php`, merged over the built-in
  one, takes a `BrowserRule` class for each rule, and
  `setupPrecognitionPlus({ rules })` takes their browser checks.
- It works for Laravel's rules that Precognition Plus doesn't run yet, like
  `date_format`, for named rules from `Validator::extend()`, and for rule
  classes from `make:rule`.
- Laravel's rules and named rules get Laravel's messages by name, with an
  extension's own message and replacer. A rule class's `BrowserRule` gives its
  message and the name of its check.
- An entry replaces a built-in rule of the same name, and `null` keeps one on
  the server.
- `askServer()` and the `RuleValidator`, `RuleValidators` and `RuleContext`
  types are exported for writing checks.
- The built-in rules, and what the server sends for them, haven't changed.
  Rules Laravel runs on empty fields, and an app's own rules that read other
  fields, stay on the server.

Earlier releases are described in the
[GitHub releases](https://github.com/CodeNyra/precognition-plus/releases).
