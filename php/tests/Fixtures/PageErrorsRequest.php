<?php

namespace CodeNyra\PrecognitionPlus\Tests\Fixtures;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

/** A form that answers a failed validation with HTML. */
class PageErrorsRequest extends FormRequest
{
    public function rules(): array
    {
        return ['name' => 'required'];
    }

    protected function failedValidation(Validator $validator): void
    {
        throw new HttpResponseException(response('<p>Missing.</p>', 422));
    }
}
