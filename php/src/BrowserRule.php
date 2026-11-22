<?php

namespace CodeNyra\PrecognitionPlus;

use CodeNyra\PrecognitionPlus\Schema\Field;

/**
 * Says when a rule can go to the browser. The built-in ones live in Rules, named after Laravel's
 * rule, and an app lists its own in config/precognition-plus.php. This class itself sends a rule
 * as it is.
 *
 * The browser rule of a rule class is made with the rule, so it can send the rule's options.
 */
class BrowserRule
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

    /** For a rule class, the name its browser check is listed under. A named rule keeps its own. */
    public function name(): ?string
    {
        return null;
    }

    /** For a rule class, the message it fails with, as it passes it to $fail(). A named rule gets Laravel's. */
    public function message(): ?string
    {
        return null;
    }
}
