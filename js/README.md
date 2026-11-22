# precognition-plus

The browser side of [Precognition
Plus](https://github.com/codenyra/precognition-plus), which checks the simple
rules of your Laravel FormRequests in the browser, so a Precognition form only
asks the server about the fields that need it.

```bash
composer require codenyra/precognition-plus
npm install precognition-plus
```

```ts
// resources/js/app.ts
import { setupPrecognitionPlus } from 'precognition-plus'

setupPrecognitionPlus()
```

Every FormRequest on a precognitive route gets its browser rules, and
`#[ServerOnly('field')]` keeps a field's rules on the server. To check rules of
your own in the browser too, pass their checks to `setupPrecognitionPlus({ rules })`,
as [your own rules](https://github.com/codenyra/precognition-plus/blob/main/docs/custom-rules.md)
shows. The
[README](https://github.com/codenyra/precognition-plus#readme) covers the
setup, the rules that run in the browser, and what the browser can see.
