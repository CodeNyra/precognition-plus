<?php

use CodeNyra\PrecognitionPlus\PrecognitionPlus;
use CodeNyra\PrecognitionPlus\Tests\Fixtures\StoreUserRequest;

beforeEach(function () {
    $this->schema = PrecognitionPlus::schema((new StoreUserRequest)->setContainer(app()));
});

it('keeps client-only fields entirely in the browser', function () {
    expect($this->schema['name'])->toBe([
        'rules' => [
            ['rule' => 'required', 'params' => [], 'message' => 'Tell us your name.'],
            ['rule' => 'string', 'params' => [], 'message' => 'The name field must be a string.'],
            ['rule' => 'max', 'params' => ['255'], 'message' => 'The name field must not be greater than 255 characters.'],
        ],
        'server' => false,
        'nullable' => false,
        'type' => 'string',
    ]);
});

it('flags server rules without serializing them', function () {
    expect($this->schema['email']['server'])->toBeTrue()
        ->and(array_column($this->schema['email']['rules'], 'rule'))->toBe(['required', 'email'])
        ->and(json_encode($this->schema))->not->toContain('unique')
        ->and($this->schema['username']['server'])->toBeTrue()
        ->and($this->schema['website'])->toMatchArray(['rules' => [], 'server' => true])
        ->and($this->schema['avatar']['server'])->toBeTrue();
});

it('formats messages with Laravel, including custom attributes and size variants', function () {
    expect($this->schema['username']['rules'][1]['message'])
        ->toBe('The handle field must not be greater than 20 characters.')
        ->and($this->schema['age'])->toMatchArray(['nullable' => true, 'type' => 'numeric'])
        ->and($this->schema['age']['rules'][1]['message'])->toBe('The age field must be at least 18.')
        ->and($this->schema['avatar']['type'])->toBe('file')
        ->and($this->schema['avatar']['rules'][0]['message'])->toBe('The avatar field must not be greater than 2048 kilobytes.');
});

it('resolves the confirmation field', function () {
    expect($this->schema['password']['rules'][2])->toMatchArray([
        'rule' => 'confirmed',
        'params' => ['password_confirmation'],
        'message' => 'The password field confirmation does not match.',
    ]);
});

it('turns Rule::in() into a client rule', function () {
    expect($this->schema['role']['server'])->toBeFalse()
        ->and($this->schema['role']['rules'][1])->toMatchArray(['rule' => 'in', 'params' => ['admin', 'editor']]);
});

it('leaves :input for the browser, with the value names Laravel would use', function () {
    app('translator')->addLines(['validation.values.role.admin' => 'Administrator'], 'en');
    $schema = PrecognitionPlus::schema((new StoreUserRequest)->setContainer(app()));

    expect($schema['code']['rules'][0]['message'])->toBe('The code :input is not valid.')
        ->and($schema['role']['values'])->toBe(['admin' => 'Administrator'])
        ->and($schema['name'])->not->toHaveKey('values');
});

it('converts PCRE patterns, and leaves untranslatable ones to the server', function () {
    expect($this->schema['code']['rules'][0])->toMatchArray(['rule' => 'regex', 'params' => ['^[A-Z]{3}$', 'i']])
        ->and($this->schema['hex']['rules'][0])->toMatchArray(['params' => ['^\#[0-9a-f]{6}$', '']])
        ->and($this->schema['letters']['rules'][0])->toMatchArray(['params' => ['^\p{L}+$', 'u']]);

    foreach (['extended', 'posix', 'spaces', 'bytes'] as $field) {
        expect($this->schema[$field])->toMatchArray(['rules' => [], 'server' => true]);
    }
});

it('names the other fields a server rule reads', function () {
    expect($this->schema['company'])->toMatchArray(['server' => true, 'depends' => ['account_type']])
        ->and($this->schema['company']['rules'][0]['rule'])->toBe('max')
        ->and($this->schema['contact']['depends'])->toBe(['email', 'phone'])
        ->and($this->schema['quantity'])->not->toHaveKey('depends')
        ->and($this->schema['name'])->not->toHaveKey('depends');
});

it('leaves array fields to the server', function () {
    expect($this->schema)->not->toHaveKey('items.*.sku');
});
