<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class ValidInviteCode implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        usleep(400_000);

        if (! in_array(strtoupper($value), ['LARAVEL', 'INERTIA'], true)) {
            $fail('That invite code is not valid. Try LARAVEL or INERTIA.');
        }
    }
}
