<?php

namespace CodeNyra\PrecognitionPlus\Tests\Fixtures;

use Illuminate\Foundation\Http\FormRequest;

class UpdateUserRequest extends FormRequest
{
    public function rules(): array
    {
        return ['name' => 'required|max:'.(10 + (int) $this->route('user'))];
    }
}
