<?php

namespace App\Http\Requests;

use App\Rules\ValidInviteCode;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SignupRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'name' => 'required|string|max:20',
            'age' => 'required|integer|between:18,99',
            'postcode' => ['required', 'regex:/^\d{5}$/'],
            'plan' => ['required', Rule::in(['free', 'pro', 'team'])],
            'password' => 'required|string|min:8|confirmed',

            'email' => 'required|email|max:255|unique:users,email',
            'username' => ['required', 'max:20', 'regex:/^[a-z0-9_]+$/', function (string $attribute, mixed $value, Closure $fail) {
                if (in_array($value, ['admin', 'root', 'taylor'], true)) {
                    $fail('That username is reserved.');
                }
            }],

            'invite' => ['nullable', new ValidInviteCode],
        ];
    }

    public function messages(): array
    {
        return [
            'postcode.regex' => 'The postcode must be exactly 5 digits.',
            'username.regex' => 'Use lowercase letters, numbers and underscores only.',
        ];
    }
}
