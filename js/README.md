# precognition-plus

The browser side of [Precognition Plus](https://github.com/codenyra/precognition-plus).
It checks the simple rules of your Laravel FormRequests (`required`, `integer`,
`min`, `max`, `regex` and a few more) in the browser, so a Precognition form
only asks the server about fields with rules like `unique`, `exists`, Rule
objects or closures.

It works together with the Laravel package, `codenyra/precognition-plus` on
Composer. Without it, forms work like plain Precognition.

```bash
composer require codenyra/precognition-plus
npm install precognition-plus
```

```ts
// resources/js/app.ts
import { setupPrecognitionPlus } from 'precognition-plus'

setupPrecognitionPlus()
```

Your forms stay as they are. The tests cover Inertia 3's `useForm` and
`<Form>` in Vue and `useForm` in React. Svelte, `useHttp()` and plain
`laravel-precognition` go through the same Precognition client, so they
should work too.

Anyone who can submit a form can read its browser rules, including `in`
lists and `regex` patterns. The
[documentation](https://github.com/codenyra/precognition-plus/tree/main/docs)
says which rules run where, and how to keep one on the server.
