<?php

namespace CodeNyra\PrecognitionPlus\Tests\Fixtures;

/** A form whose hook comes from its parent class. */
class HookedChildRequest extends UnpreparedRequest
{
    public function authorize(): bool
    {
        return true;
    }
}
