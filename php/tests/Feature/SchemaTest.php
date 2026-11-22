<?php

use CodeNyra\PrecognitionPlus\PrecognitionPlus;
use CodeNyra\PrecognitionPlus\Schema\SchemaBuilder;
use CodeNyra\PrecognitionPlus\Tests\Fixtures\Plan;
use CodeNyra\PrecognitionPlus\Tests\Fixtures\Priority;
use CodeNyra\PrecognitionPlus\Tests\Fixtures\StoreUserRequest;
use CodeNyra\PrecognitionPlus\Tests\Fixtures\Suffix;
use Illuminate\Contracts\Validation\CompilableRules;
use Illuminate\Contracts\Validation\ParameterizedRule;
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
        ->and($this->schema['age']['rules'][1]['message'])->toBe('The age field must be at least 18.');
});

it('resolves the confirmation field', function () {
    expect($this->schema['password']['rules'][2])->toMatchArray([
        'rule' => 'confirmed',
        'params' => ['password_confirmation'],
        'message' => 'The password field confirmation does not match.',
    ]);
});

it('turns Rule::in() into a browser rule', function () {
    expect($this->schema['role']['server'])->toBeFalse()
        ->and($this->schema['role']['rules'][1])->toMatchArray(['rule' => 'in', 'params' => ['admin', 'editor']]);
});

it('leaves rules whose message uses :input to the server', function () {
    $schema = (new SchemaBuilder(app('translator')))->build(
        ['code' => 'required|regex:/^[A-Z]{3}$/', 'tag' => 'starts_with::input', 'name' => 'max:3'],
        ['code.regex' => 'The code :input is not valid.'],
    );

    expect(array_column($schema['code']['rules'], 'rule'))->toBe(['required'])
        ->and($schema['code']['server'])->toBeTrue()
        ->and($schema['tag'])->toMatchArray(['rules' => [], 'server' => true])
        ->and($schema['name']['rules'][0]['rule'])->toBe('max');
});

it('sends regex patterns unchanged when PHP and JavaScript agree on them', function () {
    expect($this->schema['code']['rules'][0])->toMatchArray(['rule' => 'regex', 'params' => ['^[A-Z]{3}$', 'i']]);

    foreach (['extended', 'hex', 'letters', 'posix', 'spaces', 'bytes'] as $field) {
        expect($this->schema[$field])->toMatchArray(['rules' => [], 'server' => true]);
    }
});

it('only runs patterns in the browser that both engines read the same way', function () {
    $browser = [
        'phone' => '/^\+?\d{7,15}$/',
        'name' => '/^[A-Za-z]+ [A-Za-z]+$/',
        'colour' => '#^\#[0-9a-f]{6}$#i',
        'any' => '/^.{3,20}$/s',
        'words' => '/\bfoo\b|^[\w\s.,-]*$/',
        'lazy' => '/^a+?b{2,}?$/',
    ];
    $server = [
        'unicode' => '/^\d+$/u',
        'anchors' => '/\A[a-z]+\z/',
        'multiline' => '/^[a-z]+$/m',
        'hex' => '/^\x41$/',
        'property' => '/^\pL+$/',
        'named' => '/^(?<year>\d{4})$/',
        'lookbehind' => '/(?<=a)b/',
        'quantifier' => '/^a{,3}$/',
        'possessive' => '/^a++$/',
        'accented' => '/^[a-zé]+$/',
        // More than two repeats or choices, which can take JavaScript seconds when they overlap.
        'password' => '/^(?=.*[a-z])(?!.*\s).{8,}$/',
        'email' => '/^\S+@\S+\.\S+$/',
        'optional' => '/^a?b?c?$/',
        'alternatives' => '/^(?:\w|\d)(?:\w|\d)(?:\w|\d)$/',
    ];
    $schema = schemaFor(array_map(fn (string $pattern) => ["regex:{$pattern}"], [...$browser, ...$server]));

    foreach ($browser as $field => $pattern) {
        expect($schema[$field]['rules'][0]['params'][0])->toBe(substr($pattern, 1, strrpos($pattern, $pattern[0]) - 1));
    }

    foreach (array_keys($server) as $field) {
        expect($schema[$field])->toMatchArray(['rules' => [], 'server' => true]);
    }
});

it('keeps repeated groups on the server', function () {
    $schema = schemaFor([
        'nested' => 'regex:/^(a+)+$/',
        'choice' => 'regex:/^(a|ab)*c$/',
        'flat' => 'regex:/^(?:ab)+$/',
        'counted' => 'regex:/^(ab){2}$/',
        'optional' => 'regex:/^(\d{3}-)?\d{4}$/',
    ]);

    foreach (['nested', 'choice', 'flat', 'counted'] as $field) {
        expect($schema[$field])->toMatchArray(['rules' => [], 'server' => true]);
    }

    expect($schema['optional']['rules'][0]['params'])->toBe(['^(\d{3}-)?\d{4}$', '']);
});

it('lists the other fields a server rule reads', function () {
    expect($this->schema['company'])->toMatchArray(['server' => true, 'depends' => ['account_type']])
        ->and($this->schema['company']['rules'][0]['rule'])->toBe('max')
        ->and($this->schema['contact']['depends'])->toBe(['email', 'phone'])
        ->and($this->schema['quantity'])->not->toHaveKey('depends')
        ->and($this->schema['name'])->not->toHaveKey('depends');
});

it('lists every field that different and exclude_without read', function () {
    $schema = schemaFor(['x' => 'string|different:a,b', 'y' => 'exclude_without:a,b|required']);

    expect($schema['x']['depends'])->toBe(['a', 'b'])
        ->and($schema['y']['depends'])->toBe(['a', 'b']);
});

it('lists the field that unique takes the ignored id from', function () {
    $schema = schemaFor(['email' => 'unique:users,email,[id]', 'name' => 'unique:users,name,5']);

    expect($schema['email']['depends'])->toBe(['id'])
        ->and($schema['name'])->not->toHaveKey('depends');
});

it('leaves out fields that compare dates', function () {
    $schema = schemaFor([
        'ends_at' => 'required|after:2031-02-03',
        'starts_at' => 'required|before:ends_at',
        'born' => [Rule::date()->before(today())],
        'name' => 'required',
    ]);

    expect(array_keys($schema))->toBe(['name']);
});

it('leaves array fields to the server', function () {
    expect($this->schema)->not->toHaveKey('items.*.sku');
});

it('sends rules that only read the value to the browser', function () {
    $schema = schemaFor([
        'username' => 'required|alpha_dash:ascii|starts_with:a,b|size:8',
        'slug' => 'not_regex:/^admin/i',
        'pin' => 'digits:4',
        'price' => 'decimal:2',
        'terms' => 'accepted',
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
        ->and($schema['id']['rules'][0]['rule'])->toBe('uuid')
        ->and($schema['versioned'])->toMatchArray(['rules' => [], 'server' => true])
        ->and(array_column($schema['tags']['rules'], 'rule'))->toBe(['in'])
        ->and($schema['tags']['server'])->toBeTrue()
        ->and(array_column($schema['scores']['rules'], 'rule'))->toBe(['numeric', 'in'])
        ->and($schema['scores']['server'])->toBeTrue()
        ->and($schema['choices']['type'])->toBe('array')
        ->and($schema['choices']['rules'][0]['rule'])->toBe('in');
});

it('builds messages only for rules that go to the browser', function () {
    // A min without its parameter would make Laravel's message replacer warn.
    set_error_handler(fn () => throw new ErrorException('A rule left to the server got a message.'));

    try {
        expect(schemaFor(['bare' => 'min'])['bare'])->toMatchArray(['rules' => [], 'server' => true]);
    } finally {
        restore_error_handler();
    }
});

it('leaves a pure enum to the server', function () {
    eval('enum Mood { case Happy; case Sad; }');

    expect(schemaFor(['mood' => [Rule::enum('Mood')]])['mood'])->toMatchArray(['rules' => [], 'server' => true]);
});

it('only sends size and digit rules with plain number parameters', function () {
    $schema = schemaFor([
        'price' => 'numeric|max:9.99',
        'exponent' => 'max:1e3',
        'short' => 'between:1',
        'code' => 'digits:4.5',
    ]);

    expect($schema['price']['rules'][1])->toMatchArray(['rule' => 'max', 'params' => ['9.99']])
        ->and($schema['exponent'])->toMatchArray(['rules' => [], 'server' => true])
        ->and($schema['short'])->toMatchArray(['rules' => [], 'server' => true])
        ->and($schema['code'])->toMatchArray(['rules' => [], 'server' => true]);
});

it('leaves files and their kilobyte sizes to the server', function () {
    $schema = schemaFor([
        'avatar' => 'required|file|max:2048',
        'photo' => 'file|extensions:jpg,png',
        'upload' => 'file|integer|max:100',
    ]);

    expect(array_column($schema['avatar']['rules'], 'rule'))->toBe(['required'])
        ->and($schema['avatar'])->toMatchArray(['server' => true, 'type' => 'file'])
        ->and($schema['photo'])->toMatchArray(['rules' => [], 'server' => true, 'type' => 'file'])
        ->and(array_column($schema['upload']['rules'], 'rule'))->toBe(['integer'])
        ->and($schema['upload']['server'])->toBeTrue();
});

it("sends sizes regardless of PHP's precision setting", function () {
    $precision = ini_set('precision', '10');

    try {
        expect(array_column(schemaFor(['price' => 'numeric|max:9.99'])['price']['rules'], 'rule'))->toBe(['numeric', 'max']);
    } finally {
        ini_set('precision', $precision);
    }
});

it('reads rule objects that stand for string rules', function () {
    $schema = schemaFor([
        'role' => ['required', Rule::notIn(['root'])],
        'plan' => [Rule::enum(Plan::class)->except([Plan::Team])],
        'priority' => [Rule::enum(Priority::class)],
        'age' => [Rule::numeric()->integer()->min(18)],
        'company' => [Rule::requiredIf(fn () => true)],
    ]);

    expect($schema['role']['server'])->toBeFalse()
        ->and($schema['role']['rules'][1])->toMatchArray(['rule' => 'not_in', 'params' => ['root']])
        ->and($schema['plan']['rules'][0])->toBe(['rule' => 'enum', 'params' => ['string', 'free', 'pro'], 'message' => 'The selected plan is invalid.'])
        ->and($schema['priority']['rules'][0]['params'])->toBe(['int', '1', '2'])
        ->and(array_column($schema['age']['rules'], 'rule'))->toBe(['numeric', 'integer', 'min'])
        ->and($schema['age']['type'])->toBe('numeric')
        ->and($schema['company'])->toMatchArray(['rules' => [], 'server' => true]);
});

it('lists the confirmation field as a dependency', function () {
    $schema = schemaFor([
        'password' => ['required', 'confirmed', fn ($attribute, $value, $fail) => null],
        'pin' => 'required|confirmed:pin_again',
    ]);

    expect($schema['password']['depends'])->toBe(['password_confirmation'])
        ->and($schema['pin']['depends'])->toBe(['pin_again']);
});

it('leaves confirmed to the server when its field has a *', function () {
    $schema = schemaFor(['top' => 'confirmed:*', 'pin' => 'confirmed:codes.*']);

    expect($schema['top'])->toMatchArray(['rules' => [], 'server' => true])
        ->and($schema['pin'])->toMatchArray(['rules' => [], 'server' => true]);
});

it('leaves out fields that a * key or a skipping parent also covers', function () {
    $schema = schemaFor([
        'user.name' => 'required',
        'user.*' => 'string|max:3',
        'shipping' => 'exclude_if:same,true|array',
        'shipping.street' => 'required|max:100',
        'vat' => [['exclude_if', 'type', 'a,b'], 'required'],
        'tags' => ['array', ['in', 'a', 'b']],
        // Matched by top-level name, so a * key leaves out every field under its name, and a key
        // that may skip leaves out every other field under its name.
        'orders' => 'required|array',
        'orders.*.sku' => 'required',
        'orders.note' => 'max:5',
        'address' => 'array',
        'address.zip' => 'exclude_if:t,1',
    ]);

    expect($schema)->not->toHaveKeys(['user.name', 'shipping.street', 'orders.note', 'address'])
        ->and($schema)->toHaveKeys(['orders', 'address.zip'])
        ->and($schema['shipping'])->toMatchArray(['rules' => [], 'server' => true, 'depends' => ['same']])
        ->and($schema['vat'])->toMatchArray(['rules' => [], 'server' => true, 'depends' => ['type']])
        ->and($schema['tags']['rules'][0])->toMatchArray(['rule' => 'in', 'params' => ['a', 'b']]);
});

it('matches keys with a * in linear time', function () {
    // Keys built from the input, like answers.a*a*a*b, used to take PCRE milliseconds each.
    $stars = array_map(fn (int $i) => 'answers.'.str_repeat('a*', 20)."b{$i}", range(1, 50));
    $names = array_map(fn (int $i) => 'answers.'.str_repeat('a', 200).$i, range(1, 50));
    $start = microtime(true);
    $schema = schemaFor(array_fill_keys([...$stars, ...$names], 'max:3'));

    expect(microtime(true) - $start)->toBeLessThan(1.0)
        ->and($schema)->toBe([])
        ->and(schemaFor(['items.a*' => 'max:3', 'items.b' => 'string']))->toBe([]);
});

it('leaves out fields under Rule::forEach()', function () {
    $schema = schemaFor([
        'items.0.name' => 'required',
        'items.*' => Rule::forEach(fn () => ['name' => 'max:3']),
        'shipping' => [Rule::forEach(fn () => ['exclude'])],
        'shipping.street' => 'required',
    ]);

    expect($schema)->not->toHaveKeys(['items.0.name', 'shipping.street'])
        ->and($schema['shipping'])->toMatchArray(['rules' => [], 'server' => true]);
});

it('leaves out fields that read a field Laravel may exclude', function () {
    $schema = schemaFor([
        'a' => 'exclude_if:t,1',
        'a.x' => 'string',
        'b' => 'confirmed:a.x',
        'c' => 'required_with:a',
        'items.*' => 'exclude_unless:t,2',
        'e' => 'required_with:items.0.price',
        'z.y' => 'exclude_if:t,1',
        'h' => 'required_with:z',
        // Only the top-level name counts.
        'rows.*.note' => 'exclude_if:t,1',
        'g' => 'required_with:rows.0.price',
        'd' => 'confirmed:other',
    ]);

    expect($schema)->not->toHaveKeys(['b', 'c', 'e', 'h', 'g'])
        ->and($schema)->toHaveKeys(['a', 'd']);
});

it('treats any rule Laravel compiles from the data like Rule::forEach()', function () {
    $rule = new class implements CompilableRules
    {
        public function compile($attribute, $value, $data = null, $context = null)
        {
            return (object) ['rules' => [$attribute => ['exclude']], 'implicitAttributes' => []];
        }
    };
    $schema = schemaFor(['x' => [$rule, 'required'], 'shipping' => [$rule], 'shipping.street' => 'required']);

    expect($schema['x'])->toMatchArray(['rules' => [], 'server' => true])
        ->and($schema)->not->toHaveKey('shipping.street');
});

it('leaves a field with Rule::excludeUnless() to the server', function () {
    expect(schemaFor(['code' => [Rule::excludeUnless(true), 'required']])['code'])->toMatchArray(['rules' => [], 'server' => true]);
})->skip(! method_exists(Rule::class, 'excludeUnless'), 'Laravel releases with Rule::excludeUnless()');

it('marks fields that have sometimes', function () {
    $schema = schemaFor(['nickname' => 'sometimes|required|max:5', 'name' => 'required']);

    expect($schema['nickname'])->toMatchArray(['sometimes' => true, 'server' => false])
        ->and(array_column($schema['nickname']['rules'], 'rule'))->toBe(['required', 'max'])
        ->and($schema['name'])->not->toHaveKey('sometimes');
});

it('sends a whole field to the server when Laravel may skip its rules', function () {
    $schema = schemaFor([
        'company' => 'exclude_if:type,personal|required|max:100',
        'vat' => [Rule::excludeIf(true), 'required'],
        'notes' => ['string', 'max:3', Rule::when(true, ['nullable'])],
    ]);

    expect($schema['company'])->toMatchArray(['rules' => [], 'server' => true, 'depends' => ['type']])
        ->and($schema['vat'])->toMatchArray(['rules' => [], 'server' => true])
        ->and($schema['notes'])->toMatchArray(['rules' => [], 'server' => true]);
});

it('leaves app subclasses of Rules\\Enum to the server', function () {
    $rule = new class(Plan::class) extends Illuminate\Validation\Rules\Enum
    {
        public function passes($attribute, $value)
        {
            return $value === 'free';
        }
    };

    expect(schemaFor(['plan' => [$rule]])['plan'])->toMatchArray(['rules' => [], 'server' => true]);
});

it('sends the enum values the rule itself accepts', function () {
    $schema = schemaFor([
        'suffix' => [Rule::enum(Suffix::class)],
        'plan' => [Rule::enum(Plan::class)->only(['free', 'pro'])],
    ]);

    // Laravel compares only() and except() with cases, so plain values match nothing.
    expect($schema['suffix']['rules'][0]['params'])->toBe(['string', 'end\\', 'say "hi"', 'plain'])
        ->and($schema['plan']['rules'][0]['params'])->toBe(['string']);
});

it('looks up Rule::enum() messages the way Laravel does', function () {
    $message = fn (array $messages) => (new SchemaBuilder(app('translator')))
        ->build(['plan' => [Rule::enum(Plan::class)]], $messages)['plan']['rules'][0]['message'];

    expect($message(['plan.'.Illuminate\Validation\Rules\Enum::class => 'Pick a real plan.']))->toBe('Pick a real plan.')
        ->and($message(['plan' => 'Pick a plan.']))->toBe('Pick a plan.')
        ->and($message(['enum' => 'Not for rule objects.']))->toBe('The selected plan is invalid.');
});

it("pauses the app's missing-key callback during the build", function () {
    $calls = 0;
    app('translator')->handleMissingKeysUsing(function (string $key) use (&$calls) {
        $calls++;

        throw new RuntimeException("Missing {$key}");
    });
    $schema = schemaFor(['name' => 'required|max:3']);

    expect($calls)->toBe(0)
        ->and(array_column($schema['name']['rules'], 'rule'))->toBe(['required', 'max'])
        ->and(fn () => app('translator')->get('missing.key'))->toThrow(RuntimeException::class, 'Missing missing.key');
});

it('leaves lists and enums of more than 1,000 values to the server', function () {
    $cases = implode(' ', array_map(fn (int $i) => "case C{$i} = {$i};", range(0, 1000)));
    eval("enum ManyCases: int { {$cases} }");
    $schema = schemaFor([
        'kept' => 'in:'.implode(',', range(1, 1000)),
        'longer' => 'in:'.implode(',', range(1, 1001)),
        'long' => 'not_in:'.implode(',', range(1, 1001)),
        'enum' => [Rule::enum('ManyCases')],
    ]);

    expect($schema['kept']['rules'][0]['params'])->toHaveCount(1000)
        ->and($schema['longer'])->toMatchArray(['rules' => [], 'server' => true])
        ->and($schema['long'])->toMatchArray(['rules' => [], 'server' => true])
        ->and($schema['enum'])->toMatchArray(['rules' => [], 'server' => true]);
});

it('leaves the string form of enum to the server', function () {
    expect(schemaFor(['status' => 'enum:string,a,b'])['status'])->toMatchArray(['rules' => [], 'server' => true]);
});

it('leaves array-style rules with non-string parameters to the server', function () {
    $schema = schemaFor(['a' => [['in', 1, 2]], 'b' => [['not_in', true]], 'c' => [['in', '1', '2']]]);

    expect($schema['a'])->toMatchArray(['rules' => [], 'server' => true])
        ->and($schema['b'])->toMatchArray(['rules' => [], 'server' => true])
        ->and($schema['c']['rules'][0])->toMatchArray(['rule' => 'in', 'params' => ['1', '2']]);
});

it('leaves rule objects with array parameters to the server', function () {
    $rule = new class implements ParameterizedRule
    {
        public function toArray(): array
        {
            return ['in', 'a', ['b']];
        }

        public function __toString(): string
        {
            return 'in:a';
        }
    };
    $schema = schemaFor(['tags' => ['list', $rule], 'code' => ['string', $rule]]);

    expect($schema['tags'])->toMatchArray(['rules' => [], 'server' => true])
        ->and(array_column($schema['code']['rules'], 'rule'))->toBe(['string'])
        ->and($schema['code']['server'])->toBeTrue();
})->skip(! interface_exists(ParameterizedRule::class), 'Laravel releases with ParameterizedRule');

it('reads Rule::string()', function () {
    expect(array_column(schemaFor(['name' => [Rule::string()->max(20)]])['name']['rules'], 'rule'))->toBe(['string', 'max']);
})->skip(! method_exists(Rule::class, 'string'), 'Laravel 12.55 and later');

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
