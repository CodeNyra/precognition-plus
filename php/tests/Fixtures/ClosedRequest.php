<?php

namespace CodeNyra\PrecognitionPlus\Tests\Fixtures;

use Illuminate\Auth\Access\Response;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ClosedRequest extends FormRequest
{
    public function authorize(): Response
    {
        return Response::denyWithStatus(422, 'Sign-ups are closed.');
    }

    public function rules(): array
    {
        return ['code' => ['required', Rule::in(['SECRET'])]];
    }
}
