<?php

namespace CodeNyra\PrecognitionPlus\Rules;

use CodeNyra\PrecognitionPlus\BrowserRule;
use CodeNyra\PrecognitionPlus\Schema\Field;

/**
 * The string rule, named StringRule like Laravel's own, since PHP doesn't allow a class called String.
 *
 * @internal
 */
final class StringRule extends BrowserRule
{
    public function parameters(array $parameters, Field $field): ?array
    {
        return $parameters === [] ? [] : null;
    }
}
