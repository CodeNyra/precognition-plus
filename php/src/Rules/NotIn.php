<?php

namespace CodeNyra\PrecognitionPlus\Rules;

use CodeNyra\PrecognitionPlus\BrowserRule;
use CodeNyra\PrecognitionPlus\Schema\Field;

/**
 * Lists of more than 1,000 values stay on the server, since every response with the rules would carry them.
 *
 * @internal
 */
final class NotIn extends BrowserRule
{
    public function parameters(array $parameters, Field $field): ?array
    {
        return count($parameters) > 1000 ? null : $parameters;
    }
}
