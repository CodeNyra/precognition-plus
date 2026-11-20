# How it works

Precognition Plus is two small pieces, one on each side, and neither replaces
any part of Precognition. The Laravel side adds to some responses, and the
browser side wraps Precognition's HTTP client.

## The first validation of a form

The first time a form validates, the request goes to the server as usual,
with one extra header:

```http
POST /signup
Precognition: true
Precognition-Validate-Only: name
Precognition-Rules: true
```

Laravel validates it the normal way. Because the header is there, the package
then adds the FormRequest's browser rules to the response body, as `rules`:

| Laravel's answer | What the browser gets |
|---|---|
| `422` with `errors` | The same `422`, with `rules` next to `errors`. |
| `204`, no body | A `200` with `{"rules": {...}}`, because a 204 can't carry a body. The browser side reports it to Precognition as the `204` it stands for, so errors clear the same way. |

The `rules` object has an entry for each field, with its browser rules,
their messages, whether the field also has server rules, whether it is
`nullable`, and how its size is measured (`type`). Two more appear only when
needed: the other fields its rules name (`depends`), and the names
`validation.values` gives to values, for messages that use `:input`
(`values`):

```json
{
  "rules": {
    "name": {
      "rules": [
        { "rule": "required", "params": [], "message": "The name field is required." },
        { "rule": "max", "params": ["20"], "message": "The name field must not be greater than 20 characters." }
      ],
      "server": false,
      "nullable": false,
      "type": "string"
    },
    "email": { "rules": [ ... ], "server": true, "nullable": false, "type": "string" }
  }
}
```

The first check costs nothing extra, since Precognition would have made that
request anyway.

## Every validation after that

When Precognition is about to send a precognitive request, the browser side
looks at each field in it:

1. If its browser rules fail, the error shows at once and the field is not
   sent.
2. If they pass and the field has no server rules, it is valid and not sent.
3. If they pass and the field has server rules, it is sent only if its value,
   or a field its rules name, changed since the server last answered for it.
   Otherwise the last answer is reused.

If nothing is left to send, there is no request at all, and Precognition
gets an answer that looks like the server's. Otherwise one request goes out,
narrowed with `Precognition-Validate-Only` to the fields that need the
server, and its answer is merged with the browser's.

When a form starts a new check while its previous request is still running,
the previous request is cancelled, so a slow answer never overwrites a newer
one.

Precognition itself still debounces, tracks touched and valid fields and
holds the errors, so `form.errors`, `invalid()` and `valid()` behave the
same whichever side found an error.

## The submit

A real submit is not precognitive, so the package leaves it alone. It goes to
the server with every rule, as before.

## When the rules are built

On the server, the package notes the FormRequest when Laravel resolves it for
a request that has `Precognition-Rules`. After the response is ready, it
builds the rules from that FormRequest's own rules, messages and attribute
names. That is after `authorize()` and after validation, so everything the
rules depend on (route parameters, the signed-in user, the database) is what
the real request saw.

The rules are added only when all of this holds; otherwise the response
is left untouched:

- the request is precognitive and asked with `Precognition-Rules`;
- it went through a FormRequest;
- Laravel answered `204` or `422` (an authorization failure, a redirect or an
  exception is left as it is);
- `PRECOGNITION_PLUS_ENABLED` is not `false`.

If building the rules fails, the error is reported to your error handler and
the response goes out without them; the browser then falls back to plain
Precognition for that form.

## When the rules are forgotten

The browser keeps what it learned for each form (its method and URL) until
Inertia moves to another page. Then each form asks for its rules again on its
first validation. A full page load starts over too.
