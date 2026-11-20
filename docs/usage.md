# Usage guide

There is no new API. You write FormRequests and forms the way the Precognition
docs describe, and Precognition Plus decides, field by field, whether the
browser can answer or the server has to.

## A FormRequest

```php
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreUserRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'name' => 'required|string|max:255',                // browser only
            'age' => 'required|integer|between:18,99',          // browser only
            'role' => ['required', Rule::in(['admin', 'user'])], // browser only
            'email' => 'required|email|max:255|unique:users',   // browser, then the server
            'team_id' => ['required', 'exists:teams,id'],       // browser, then the server
            'coupon' => ['nullable', new ValidCoupon],          // server only
        ];
    }
}
```

Each field ends up in one of three groups:

| Group | Its rules | While the user types |
|---|---|---|
| Browser only | Only [browser rules](rules.md) | Never sent to the server. |
| Browser, then the server | Browser rules plus at least one server rule | Checked in the browser first. Sent to the server alone, and only when the browser rules pass and the value, or a field its rules name, changed since the server last answered. |
| Server only | No browser rules | Sent to the server alone whenever its value, or a field its rules name, changed. |

Submitting the form isn't affected. It goes to the server with every rule, as
before.

## Vue

```vue
<script setup>
import { useForm } from '@inertiajs/vue3'

const form = useForm('post', '/users', { name: '', email: '' })
</script>

<template>
  <form @submit.prevent="form.submit()">
    <input v-model="form.name" @change="form.validate('name')" />
    <p v-if="form.invalid('name')">{{ form.errors.name }}</p>

    <input v-model="form.email" @change="form.validate('email')" />
    <p v-if="form.invalid('email')">{{ form.errors.email }}</p>

    <button :disabled="form.processing">Save</button>
  </form>
</template>
```

## React

```tsx
import { useForm } from '@inertiajs/react'

export default function CreateUser() {
  const form = useForm('post', '/users', { name: '', email: '' })

  return (
    <form onSubmit={(e) => { e.preventDefault(); form.submit() }}>
      <input value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} onBlur={() => form.validate('name')} />
      {form.invalid('name') && <p>{form.errors.name}</p>}

      <input value={form.data.email} onChange={(e) => form.setData('email', e.target.value)} onBlur={() => form.validate('email')} />
      {form.invalid('email') && <p>{form.errors.email}</p>}

      <button disabled={form.processing}>Save</button>
    </form>
  )
}
```

## Svelte, `<Form>`, `useHttp()` and plain `laravel-precognition`

These all go through the same Precognition client. The tests cover `<Form>`
in Vue. Svelte, `useHttp()` and plain `laravel-precognition` aren't tested yet
but should work unchanged. Follow the Precognition docs for each.

## Files

Precognition only sends files when the form calls `validateFiles()`. With it,
`file`, `extensions`, and `min`, `max`, `between` and `size` in kilobytes are
checked in the browser. Rules that read the file's content, like `image` and
`mimes`, go to the server, again each time another file is picked.

## Getting the most out of it

### Give server fields browser rules too

For a field with both kinds of rules, the browser rules run first, wherever
they are in the list, and the server is asked only when they pass. So
`'required|email|max:255|unique:users'` never asks the server about an empty
or malformed address.

### Keep server-only fields few

A field with only a closure or a Rule class of your own goes to the server
every time its value changes. Where part of the check can be written as browser rules,
add them. `['required', 'alpha_num', 'size:8', new ValidCoupon]` stops codes
of the wrong length or with the wrong characters in the browser.

### Leave the messages to Laravel

The browser shows the messages Laravel would, built on the server from your
translations, `messages()` and `attributes()`, so there is nothing to
translate twice.

### Password confirmation

Laravel puts `confirmed` on `password`, so `password_confirmation` has no
rules of its own, and validating it alone asks the server. Validate `password`
when the confirmation changes instead, and the browser checks both:

```vue
<input v-model="form.password_confirmation" @change="form.validate('password')" />
```

### Rules that depend on the request

The rules are built on the server from the real request, after `authorize()`
passed, so rules that use route parameters, the signed-in user or the
database are correct:

```php
'category_id' => ['required', Rule::in(Category::pluck('id'))],      // browser: the list is sent once
'slug' => ['required', Rule::unique('posts')->ignore($this->post)],  // server
```

### Rules that depend on other fields

Write them with Laravel's rules, such as `required_if`, `required_with`,
`same` or `after`. The server tells the browser which fields each of them
names, and the browser asks again when one of those changes. Here `company`
goes back to the server whenever `type` changes:

```php
'company' => ['required_if:type,business', 'nullable', 'max:100'],
```

Don't pick rules with PHP based on other input. The browser keeps the rules
from the form's first request, so it would go on checking the old ones:

```php
// The browser keeps whichever of these the first request got.
'company' => $this->input('type') === 'business' ? 'required|max:100' : 'nullable',
```

A closure or a Rule class of your own that reads another field has the same
problem in a smaller way. Its field goes back to the server only when its own value
changes.

### Keeping a rule private

Everything in a browser rule is visible to the user, including every value of
an `in` or `not_in` list, every enum value and every `regex` pattern. To keep
something private, check it with a server rule instead. Server rules are never
sent to the browser:

```php
'coupon' => ['required', Rule::in(Coupon::pluck('code'))],   // every code is sent to the browser
'coupon' => ['required', Rule::exists('coupons', 'code')],   // checked on the server only
```

## Several forms on one page

Each form, by method and URL, learns its own rules with its own first
request. Two forms that post to the same URL share them. When Inertia moves
to another page, everything learned is forgotten and each form asks again.

## Testing

Feature tests need no changes. A precognitive request without the
`Precognition-Rules` header gets Laravel's usual answer. To see what the
browser would get, send the header yourself:

```php
$this->withHeaders(['Precognition' => 'true', 'Precognition-Rules' => 'true'])
    ->postJson('/users', [])
    ->assertStatus(422)
    ->assertJsonStructure(['errors', 'rules' => ['name', 'email']]);
```
