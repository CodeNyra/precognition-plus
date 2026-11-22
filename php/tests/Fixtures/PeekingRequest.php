<?php

namespace CodeNyra\PrecognitionPlus\Tests\Fixtures;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\ValidationException;

/** Builds its validator in authorize() to look at the data, then fails with a 422 of its own. */
class PeekingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->getValidatorInstance()->getData() !== ['code' => 'x'];
    }

    public function rules(): array
    {
        return ['code' => 'required|max:10'];
    }

    protected function failedAuthorization(): void
    {
        throw ValidationException::withMessages(['code' => 'Not yet.']);
    }
}
