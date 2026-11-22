<?php

namespace CodeNyra\PrecognitionPlus\Rules;

use CodeNyra\PrecognitionPlus\BrowserRule;
use CodeNyra\PrecognitionPlus\Schema\Field;

/**
 * Plain email and email:rfc only. Other options, like dns or strict, stay on the server.
 *
 * @internal
 */
final class Email extends BrowserRule
{
    public function parameters(array $parameters, Field $field): ?array
    {
        return array_diff($parameters, ['rfc']) === [] ? $parameters : null;
    }
}
