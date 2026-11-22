<?php

namespace CodeNyra\PrecognitionPlus\Tests\Fixtures\Browser;

use CodeNyra\PrecognitionPlus\BrowserRule;
use CodeNyra\PrecognitionPlus\Schema\Field;
use CodeNyra\PrecognitionPlus\Tests\Fixtures\Checked as Rule;

/** Sends a Checked rule the way the test set it up. */
final class Checked extends BrowserRule
{
    public function __construct(private readonly Rule $rule) {}

    public function name(): ?string
    {
        return $this->rule->name;
    }

    public function message(): ?string
    {
        return $this->rule->message;
    }

    public function parameters(array $parameters, Field $field): ?array
    {
        return $this->rule->params;
    }
}
