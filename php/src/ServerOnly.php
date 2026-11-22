<?php

namespace CodeNyra\PrecognitionPlus;

use Attribute;
use Illuminate\Support\Arr;

/** Keeps the rules of the named fields, and of the fields nested under them, on the server. A * matches any key. */
#[Attribute(Attribute::TARGET_CLASS | Attribute::IS_REPEATABLE)]
final class ServerOnly
{
    /** @var list<string> */
    public readonly array $fields;

    /** @param  list<string>|string  ...$fields */
    public function __construct(array|string ...$fields)
    {
        $this->fields = Arr::flatten($fields);
    }
}
