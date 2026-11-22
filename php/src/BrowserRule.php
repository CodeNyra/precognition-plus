<?php

namespace CodeNyra\PrecognitionPlus;

use CodeNyra\PrecognitionPlus\Schema\Field;

/**
 * A rule the browser can check. Each one lives in Rules, named after Laravel's rule.
 *
 * @internal
 */
abstract class BrowserRule
{
    /**
     * The parameters to send to the browser, or null when this use of the rule needs the server.
     *
     * @param  list<string>  $parameters
     * @return list<string>|null
     */
    public function parameters(array $parameters, Field $field): ?array
    {
        return $parameters;
    }
}
