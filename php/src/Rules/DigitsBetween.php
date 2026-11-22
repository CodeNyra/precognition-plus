<?php

namespace CodeNyra\PrecognitionPlus\Rules;

use CodeNyra\PrecognitionPlus\BrowserRule;
use CodeNyra\PrecognitionPlus\Schema\Field;
use CodeNyra\PrecognitionPlus\Support\Numbers;

/** @internal */
final class DigitsBetween extends BrowserRule
{
    public function parameters(array $parameters, Field $field): ?array
    {
        return Numbers::whole($parameters, 2) ? $parameters : null;
    }
}
