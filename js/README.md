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
`#[ServerOnly('field')]` keeps a field's rules on the server. The
[README](https://github.com/codenyra/precognition-plus#readme) covers the
setup, the rules that run in the browser, and what the browser can see.
