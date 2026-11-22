<?php

namespace CodeNyra\PrecognitionPlus\Support;

use CodeNyra\PrecognitionPlus\Schema\Field;

/**
 * Parameter checks for the size and digit rules and decimal, since Laravel throws when parameters are missing.
 *
 * @internal
 */
final class Numbers
{
    /** At least $count parameters, all whole numbers, as the digit rules and decimal take them. */
    public static function whole(array $parameters, int $count): bool
    {
        return count($parameters) >= $count && preg_grep('/^\d+$/', $parameters, PREG_GREP_INVERT) === [];
    }

    /** At least $count plain decimals, as min, max, size and between take them. Not for files, which are sized in kilobytes. */
    public static function size(array $parameters, int $count, Field $field): bool
    {
        return $field->type !== 'file'
            && count($parameters) >= $count
            && preg_grep('/^-?\d+(\.\d+)?$/', $parameters, PREG_GREP_INVERT) === [];
    }
}
