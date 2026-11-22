<?php

namespace CodeNyra\PrecognitionPlus\Rules;

use CodeNyra\PrecognitionPlus\BrowserRule;
use CodeNyra\PrecognitionPlus\Schema\Field;
use CodeNyra\PrecognitionPlus\Support\Numbers;

/** @internal */
final class Max extends BrowserRule
{
    public function parameters(array $parameters, Field $field): ?array
    {
        return Numbers::size($parameters, 1, $field) ? $parameters : null;
    }
}
