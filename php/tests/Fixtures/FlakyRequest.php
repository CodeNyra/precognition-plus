<?php

namespace CodeNyra\PrecognitionPlus\Tests\Fixtures;

use Illuminate\Foundation\Http\FormRequest;
use RuntimeException;

/** Gives Laravel its messages, then throws when the rules ask for them again. */
class FlakyRequest extends FormRequest
{
    private int $asked = 0;

    public function rules(): array
    {
        return ['name' => 'required'];
    }

    public function messages(): array
    {
        if ($this->asked++ > 0) {
            throw new RuntimeException('Asked twice.');
        }

        return [];
    }
}
