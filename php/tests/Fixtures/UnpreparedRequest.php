<?php

namespace CodeNyra\PrecognitionPlus\Tests\Fixtures;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class UnpreparedRequest extends FormRequest
{
    public function authorize(): bool
    {
        return false;
    }

    public function rules(): array
    {
        return ['code' => ['required', Rule::in(['SECRET'])]];
    }

    protected function prepareForValidation(): void
    {
        throw ValidationException::withMessages(['code' => 'Not yet.']);
    }
}
