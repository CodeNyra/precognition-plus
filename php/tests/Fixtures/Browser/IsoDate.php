<?php

namespace CodeNyra\PrecognitionPlus\Tests\Fixtures\Browser;

use CodeNyra\PrecognitionPlus\BrowserRule;
use CodeNyra\PrecognitionPlus\Schema\Field;
use CodeNyra\PrecognitionPlus\Tests\Fixtures\IsoDate as Rule;

/** The browser half of the IsoDate rule class, from docs/custom-rules.md. */
final class IsoDate extends BrowserRule
{
    public function __construct(private readonly Rule $rule) {}

    public function name(): ?string
    {
        return 'iso_date';
    }

    public function message(): ?string
    {
        return Rule::MESSAGE;
    }

    public function parameters(array $parameters, Field $field): ?array
    {
        return [(string) $this->rule->from];
    }
}
