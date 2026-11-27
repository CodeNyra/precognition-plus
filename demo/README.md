# Precognition Plus demo

A signup form with fields checked in the browser only, in the browser and
then on the server, or on the server only, plus a panel that shows where each
check ran. The same form runs at
[precognition.codenyra.com](https://precognition.codenyra.com).

This folder holds only the demo's own files. `setup.sh` makes a fresh
Laravel 13 app in `demo/laravel`, adds Inertia and this repository's
packages (not the published ones), and copies `files/` over it:

```bash
./demo/setup.sh
cd demo/laravel && php artisan serve
```

Then open http://localhost:8000. It needs PHP 8.3+, Composer and Node 22+,
and takes about a minute. Running it again starts over. `demo/laravel` isn't
in git, so make your changes in `files/` and run `setup.sh` again, or copy the
changed file across while you work.

| File in `files/` | What |
|---|---|
| `app/Http/Requests/SignupRequest.php` | The form's rules, one field of each kind. |
| `app/Rules/ValidInviteCode.php` | A Rule object, so its field always asks the server. |
| `routes/web.php` | The page, and the route that saves a signup. |
| `resources/js/Pages/Signup.vue` | The form, a stock `useForm('post', '/signup')`. With `?compact` it shows four fields and how many requests went to the server. |
| `resources/js/app.js` | `setupPrecognitionPlus()`, plus the on/off switch. |
| `resources/js/demo/requestLog.js` | The log panel. A real app doesn't need it. `?plus=off` starts with plain Laravel Precognition. |
| `resources/views/app.blade.php` | Inertia's page template. |
| `bootstrap/app.php`, `vite.config.js` | The skeleton's files with Inertia and Vue added. |

## The README's GIF

`docs/demo.gif` shows the same form filled in with plain Laravel Precognition
and with Precognition Plus, side by side, with the number of requests each one
sends to the server. To record it again, start the demo, then run the script in
`scripts/`, which needs ffmpeg:

```bash
cd demo/scripts
npm install && npx playwright install chromium
node record-gif.mjs http://localhost:8000
```

It opens `/?compact&plus=off` and `/?compact` in two pages, types the same
values into both, and joins the two recordings into one GIF.
