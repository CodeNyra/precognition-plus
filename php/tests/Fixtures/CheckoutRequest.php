<?php

namespace CodeNyra\PrecognitionPlus\Tests\Fixtures;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CheckoutRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'name' => 'required|max:10',
            'coupon' => ['nullable', Rule::in(['SECRET-10', 'SECRET-20'])],
            'payment' => 'required',
            'payment.card' => 'required|digits:16',
            'plan' => ['required', Rule::in(['free', 'pro'])],
        ];
    }
}
