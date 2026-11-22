<?php

namespace CodeNyra\PrecognitionPlus\Tests\Fixtures;

use Illuminate\Foundation\Http\FormRequest;

/** Sets the translator's locale in authorize(), as an app may from the user's settings. */
class LocalizedRequest extends FormRequest
{
    public function authorize(): bool
    {
        app('translator')->setLocale('de');

        return true;
    }

    public function rules(): array
    {
        return ['name' => 'required'];
    }
}
