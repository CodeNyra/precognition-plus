<?php

namespace CodeNyra\PrecognitionPlus\Rules;

use CodeNyra\PrecognitionPlus\BrowserRule;
use CodeNyra\PrecognitionPlus\Schema\Field;

/**
 * Plain uuid only. Version checks like uuid:4 stay on the server.
 *
 * @internal
 */
final class Uuid extends BrowserRule
{
    public function parameters(array $parameters, Field $field): ?array
    {
        return $parameters === [] ? [] : null;
    }
}
