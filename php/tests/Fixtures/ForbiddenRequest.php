<?php

namespace CodeNyra\PrecognitionPlus\Tests\Fixtures;

use Illuminate\Foundation\Http\FormRequest;

class ForbiddenRequest extends FormRequest
{
    public function authorize(): bool
    {
        return false;
    }

    public function rules(): array
    {
        return ['title' => 'required'];
    }
}
