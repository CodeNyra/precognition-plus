<?php

namespace CodeNyra\PrecognitionPlus\Schema;

/**
 * What a rule may look at besides its own parameters.
 *
 * @internal
 */
final readonly class Field
{
    public function __construct(
        public string $attribute,
        public string $type,
    ) {}
}
