<?php

namespace CodeNyra\PrecognitionPlus\Tests\Fixtures;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/** The rule class from docs/custom-rules.md, with its option. */
class IsoDate implements ValidationRule
{
    public const MESSAGE = 'The :attribute field must be a date like 2024-12-31.';

    public function __construct(public readonly int $from = 1) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value)
            || ! preg_match('/^(\d{4})-(\d{2})-(\d{2})\z/', $value, $date)
            || ! checkdate((int) $date[2], (int) $date[3], (int) $date[1])
            || (int) $date[1] < $this->from) {
            $fail(self::MESSAGE);
        }
    }
}
