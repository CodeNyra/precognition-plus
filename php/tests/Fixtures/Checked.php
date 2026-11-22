<?php

namespace CodeNyra\PrecognitionPlus\Tests\Fixtures;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/** A rule class whose browser half sends the name, message and parameters a test gives it. */
class Checked implements ValidationRule
{
    public function __construct(
        public readonly ?string $name = 'checked',
        public readonly ?string $message = 'The :attribute field is wrong.',
        public readonly mixed $params = [],
    ) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $fail((string) $this->message);
    }
}
