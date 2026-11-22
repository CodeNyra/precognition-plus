<?php

namespace CodeNyra\PrecognitionPlus\Rules;

use CodeNyra\PrecognitionPlus\BrowserRule;
use CodeNyra\PrecognitionPlus\Schema\Field;

/**
 * Compares with {attribute}_confirmation or the field it names. A name with a * stays on the server, since Laravel renames those.
 *
 * @internal
 */
final class Confirmed extends BrowserRule
{
    public function parameters(array $parameters, Field $field): ?array
    {
        $other = $parameters[0] ?? $field->attribute.'_confirmation';

        return str_contains($other, '*') ? null : [$other];
    }
}
