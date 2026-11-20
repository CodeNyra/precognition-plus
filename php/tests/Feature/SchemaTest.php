<?php

use CodeNyra\PrecognitionPlus\PrecognitionPlus;
use CodeNyra\PrecognitionPlus\Schema\SchemaBuilder;
use CodeNyra\PrecognitionPlus\Tests\Fixtures\Plan;
use CodeNyra\PrecognitionPlus\Tests\Fixtures\StoreUserRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Regex;

beforeEach(function () {
    $this->schema = PrecognitionPlus::schema((new StoreUserRequest)->setContainer(app()));
});

function schemaFor(array $rules): array
{
    return (new SchemaBuilder(app('translator')))->build($rules);
}

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

it('sends the value-only rules to the browser', function () {
    $schema = schemaFor([
        'username' => 'required|alpha_dash:ascii|starts_with:a,b|size:8',
        'slug' => 'not_regex:/^admin/i',
        'pin' => 'digits:4',
        'price' => 'decimal:2',
        'terms' => 'accepted',
        'avatar' => 'file|extensions:jpg,png',
        'id' => 'uuid',
        'versioned' => 'uuid:4',
        'tags' => 'list|in:a,b',
        'scores' => 'array|numeric|in:1,2',
        'choices' => 'array|in:a,b',
    ]);

    expect(array_column($schema['username']['rules'], 'rule'))->toBe(['required', 'alpha_dash', 'starts_with', 'size'])
        ->and($schema['username'])->toMatchArray(['server' => false, 'type' => 'string'])
        ->and($schema['username']['rules'][3]['message'])->toBe('The username field must be 8 characters.')
        ->and($schema['slug']['rules'][0])->toMatchArray(['rule' => 'not_regex', 'params' => ['^admin', 'i']])
        ->and($schema['pin']['rules'][0])->toMatchArray(['rule' => 'digits', 'params' => ['4'], 'message' => 'The pin field must be 4 digits.'])
        ->and($schema['price']['type'])->toBe('numeric')
        ->and($schema['terms']['rules'][0]['rule'])->toBe('accepted')
        ->and($schema['avatar'])->toMatchArray(['server' => false, 'type' => 'file'])
        ->and($schema['id']['rules'][0]['rule'])->toBe('uuid')
        ->and($schema['versioned'])->toMatchArray(['rules' => [], 'server' => true])
        ->and($schema['tags'])->toMatchArray(['rules' => [], 'server' => true])
        ->and(array_column($schema['scores']['rules'], 'rule'))->toBe(['numeric'])
        ->and($schema['scores']['server'])->toBeTrue()
        ->and($schema['choices']['type'])->toBe('array')
        ->and($schema['choices']['rules'][0]['rule'])->toBe('in');
});

it('reads rule objects that stand for plain rules', function () {
    $schema = schemaFor([
        'role' => ['required', Rule::notIn(['root'])],
        'plan' => [Rule::enum(Plan::class)->except([Plan::Team])],
        'age' => [Rule::numeric()->integer()->min(18)],
        'name' => [Rule::string()->max(20)],
        'company' => [Rule::requiredIf(fn () => true)],
    ]);

    expect($schema['role']['server'])->toBeFalse()
        ->and($schema['role']['rules'][1])->toMatchArray(['rule' => 'not_in', 'params' => ['root']])
        ->and($schema['plan']['rules'][0])->toBe(['rule' => 'enum', 'params' => ['free', 'pro'], 'message' => 'The selected plan is invalid.'])
        ->and(array_column($schema['age']['rules'], 'rule'))->toBe(['numeric', 'integer', 'min'])
        ->and($schema['age']['type'])->toBe('numeric')
        ->and(array_column($schema['name']['rules'], 'rule'))->toBe(['string', 'max'])
        ->and($schema['company'])->toMatchArray(['rules' => [], 'server' => true]);
});

it('reads the rule objects Laravel 13 added', function () {
    $schema = schemaFor([
        'code' => [Rule::regex('/^[A-Z]+$/')],
        'password' => ['required', Rule::confirmed()],
        'phone' => [Rule::requiredWith('email')],
    ]);

    expect($schema['code']['rules'][0])->toMatchArray(['rule' => 'regex', 'params' => ['^[A-Z]+$', '']])
        ->and($schema['password']['rules'][1])->toMatchArray(['rule' => 'confirmed', 'params' => ['password_confirmation']])
        ->and($schema['phone'])->toMatchArray(['server' => true, 'depends' => ['email']]);
})->skip(! class_exists(Regex::class), 'Laravel 13 only');
