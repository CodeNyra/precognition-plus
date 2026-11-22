<?php

namespace CodeNyra\PrecognitionPlus\Rules;

use CodeNyra\PrecognitionPlus\BrowserRule;
use CodeNyra\PrecognitionPlus\Schema\Field;
use CodeNyra\PrecognitionPlus\Support\JavaScriptPattern;

/**
 * Sends the pattern as is when PHP and JavaScript read it the same way, and leaves it to the server otherwise.
 *
 * @internal
 */
final class NotRegex extends BrowserRule
{
    public function parameters(array $parameters, Field $field): ?array
    {
        return JavaScriptPattern::from($parameters[0] ?? '');
    }
}
