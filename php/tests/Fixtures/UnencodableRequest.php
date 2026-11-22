<?php

namespace CodeNyra\PrecognitionPlus\Tests\Fixtures;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UnencodableRequest extends FormRequest
{
    public function rules(): array
    {
        return ['name' => 'required', 'code' => ['nullable', Rule::in(["\xB1"])]];
    }
}
