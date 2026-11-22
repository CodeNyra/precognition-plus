<?php

namespace CodeNyra\PrecognitionPlus\Rules;

use CodeNyra\PrecognitionPlus\BrowserRule;
use CodeNyra\PrecognitionPlus\Schema\Field;

/**
 * Plain integer only. integer:strict, which needs an actual int, stays on the server.
 *
 * @internal
 */
final class Integer extends BrowserRule
{
    public function parameters(array $parameters, Field $field): ?array
    {
        return $parameters === [] ? [] : null;
    }
}
