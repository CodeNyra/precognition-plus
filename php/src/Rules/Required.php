<?php

namespace CodeNyra\PrecognitionPlus\Rules;

use CodeNyra\PrecognitionPlus\BrowserRule;
use CodeNyra\PrecognitionPlus\Schema\Field;

/** @internal */
final class Required extends BrowserRule
{
    public function parameters(array $parameters, Field $field): ?array
    {
        return $parameters === [] ? [] : null;
    }
}
