<?php

namespace CodeNyra\PrecognitionPlus\Tests\Fixtures\Browser;

use CodeNyra\PrecognitionPlus\BrowserRule;
use CodeNyra\PrecognitionPlus\Schema\Field;

/** The browser half of date_format:Y-m-d, from docs/custom-rules.md. */
final class DateFormat extends BrowserRule
{
    public function parameters(array $parameters, Field $field): ?array
    {
        return $parameters === ['Y-m-d'] ? $parameters : null;
    }
}
