<?php

namespace CodeNyra\PrecognitionPlus\Rules;

use CodeNyra\PrecognitionPlus\BrowserRule;
use CodeNyra\PrecognitionPlus\Schema\Field;

/**
 * Plain numeric only. numeric:strict, which rejects numbers sent as strings, stays on the server.
 *
 * @internal
 */
final class Numeric extends BrowserRule
{
    public function parameters(array $parameters, Field $field): ?array
    {
        return $parameters === [] ? [] : null;
    }
}
