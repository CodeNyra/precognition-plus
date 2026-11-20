# Precognition Plus demo

A signup form whose fields are checked in the browser, in the browser and
then on the server, or on the server only, with a panel that shows where each
check was answered. The same form runs at
[precognition.codenyra.com](https://precognition.codenyra.com).

This folder holds only the demo's own files. `setup.sh` makes a fresh
Laravel 13 app in `demo/laravel`, adds Inertia and this repository's
packages (not the published ones), and copies `files/` over it:

```bash
./demo/setup.sh
cd demo/laravel && php artisan serve
```

Then open http://localhost:8000. It needs PHP 8.3+, Composer and Node 22+,
and takes about a minute. Running it again starts over. `demo/laravel` is
not in git: change the demo in `files/`, then run `setup.sh` again, or copy
the changed file across while you work.

| File in `files/` | What |
|---|---|
| `app/Http/Requests/SignupRequest.php` | The form's rules, one field of each kind. |
| `app/Rules/ValidInviteCode.php` | A Rule object, so its field always asks the server. |
| `routes/web.php` | The page, and the route that saves a signup. |
| `resources/js/Pages/Signup.vue` | The form: a stock `useForm('post', '/signup')`. |
| `resources/js/app.js` | `setupPrecognitionPlus()`, plus the on/off switch. |
| `resources/js/demo/requestLog.js` | The log panel. A real app doesn't need it. |
| `resources/views/app.blade.php` | Inertia's page template. |
| `bootstrap/app.php`, `vite.config.js` | The skeleton's files with Inertia and Vue added. |
