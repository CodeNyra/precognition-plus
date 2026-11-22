<?php

namespace CodeNyra\PrecognitionPlus\Tests\Fixtures;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreUserRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'name' => 'required|string|max:255',
            'username' => ['required', 'max:20', function (string $attribute, mixed $value, \Closure $fail) {
                if ($value === 'taken') {
                    $fail('That username is taken.');
                }
            }],
            'email' => ['required', 'email', Rule::unique('users')],
            'password' => ['required', 'min:8', 'confirmed'],
            'age' => 'nullable|integer|min:18',
            'role' => ['required', Rule::in(['admin', 'editor'])],
            'code' => ['regex:/^[A-Z]{3}$/i'],
            'extended' => ['regex:/^a b$/x'],
            'hex' => ['regex:#^\#[0-9a-f]{6}\z#'],
            'letters' => ['regex:/^\p{L}+$/u'],
            'posix' => ['regex:/^[[:digit:]]+$/'],
            'spaces' => ['regex:/^\h+$/'],
            'bytes' => ['regex:/^\p{L}+$/'],
            'company' => 'required_if:account_type,business|max:100',
            'contact' => 'required_without_all:email,phone',
            'quantity' => 'nullable|integer|gt:0',
            'items.*.sku' => 'required|string',
            'avatar' => 'nullable|image|max:2048',
            'website' => 'nullable|url|active_url',
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Tell us your name.',
        ];
    }

    public function attributes(): array
    {
        return ['username' => 'handle'];
    }
}
