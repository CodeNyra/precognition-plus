<?php

namespace CodeNyra\PrecognitionPlus\Tests\Fixtures;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

class ShapedErrorsRequest extends FormRequest
{
    public function rules(): array
    {
        return ['name' => 'required'];
    }

    protected function failedValidation(Validator $validator): void
    {
        $body = '{"message":"Missing.","7":"x","3":"y","meta":{},"ratio":1.0,"errors":{"name":["Missing."]}}'."\n";

        throw new HttpResponseException(response($body, 422, [
            'Content-Type' => 'application/problem+json',
            'Content-Length' => (string) strlen($body),
            'ETag' => '"errors"',
        ]));
    }
}
