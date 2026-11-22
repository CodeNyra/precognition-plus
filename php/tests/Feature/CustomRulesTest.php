<?php

use CodeNyra\PrecognitionPlus\BrowserRule;
use CodeNyra\PrecognitionPlus\PrecognitionPlus;
use CodeNyra\PrecognitionPlus\Tests\Fixtures\Browser\Checked as CheckedBrowser;
use CodeNyra\PrecognitionPlus\Tests\Fixtures\Browser\DateFormat;
use CodeNyra\PrecognitionPlus\Tests\Fixtures\Browser\IsoDate as IsoDateBrowser;
use CodeNyra\PrecognitionPlus\Tests\Fixtures\Checked;
use CodeNyra\PrecognitionPlus\Tests\Fixtures\IsoDate;
use Illuminate\Contracts\Validation\DataAwareRule;
use Illuminate\Contracts\Validation\ImplicitRule;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Contracts\Validation\ValidatorAwareRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Exceptions;
use Illuminate\Support\Facades\Validator;

// The three examples from docs/custom-rules.md, set up the way an app would.
beforeEach(function () {
    config()->set('precognition-plus.rules', [
        'date_format' => DateFormat::class,
        'iso_date' => BrowserRule::class,
        IsoDate::class => IsoDateBrowser::class,
        Checked::class => CheckedBrowser::class,
    ]);

    Validator::extend('iso_date', fn (string $attribute, mixed $value) => is_string($value)
        && preg_match('/^(\d{4})-(\d{2})-(\d{2})\z/', $value, $date)
        && checkdate((int) $date[2], (int) $date[3], (int) $date[1]));

    // Load Laravel's own lines first, or adding one stops the rest from loading.
    app('translator')->load('*', 'validation', 'en');
    app('translator')->addLines(['validation.iso_date' => 'The :attribute field must be a date like 2024-12-31.'], 'en');
});

function listAppRules(array $rules): void
{
    config()->set('precognition-plus.rules', [...config('precognition-plus.rules'), ...$rules]);
}

/** The rules Precognition Plus sends for a FormRequest with these rules, messages and attributes. */
function appRulesFor(array $rules, array $messages = [], array $attributes = []): ?array
{
    $form = new class($rules, $messages, $attributes) extends FormRequest
    {
        public function __construct(private array $given = [], private array $givenMessages = [], private array $givenAttributes = [])
        {
            parent::__construct();
        }

        public function rules(): array
        {
            return $this->given;
        }

        public function messages(): array
        {
            return $this->givenMessages;
        }

        public function attributes(): array
        {
            return $this->givenAttributes;
        }
    };

    return PrecognitionPlus::schema($form->setContainer(app()));
}

function laravelFirstMessage(array $rules, mixed $value, array $messages = [], array $attributes = []): string
{
    return Validator::make(['birthday' => $value], ['birthday' => $rules], $messages, $attributes)->errors()->first('birthday');
}

it('sends the three kinds of rules an app can list', function () {
    $schema = appRulesFor([
        'start' => ['required', 'date_format:Y-m-d'],
        'birthday' => ['required', 'iso_date'],
        'anniversary' => ['required', new IsoDate(from: 1900)],
    ]);

    expect($schema['start']['server'])->toBeFalse()
        ->and($schema['start']['rules'][1])->toBe(['rule' => 'date_format', 'params' => ['Y-m-d'], 'message' => 'The start field must match the format Y-m-d.'])
        ->and($schema['birthday']['server'])->toBeFalse()
        ->and($schema['birthday']['rules'][1])->toBe(['rule' => 'iso_date', 'params' => [], 'message' => 'The birthday field must be a date like 2024-12-31.'])
        ->and($schema['anniversary']['server'])->toBeFalse()
        ->and($schema['anniversary']['rules'][1])->toBe(['rule' => 'iso_date', 'params' => ['1900'], 'message' => 'The anniversary field must be a date like 2024-12-31.']);
});

it('leaves a use to the server when its PHP half returns null', function () {
    $start = appRulesFor(['start' => ['required', 'date_format:d/m/Y']])['start'];

    expect(array_column($start['rules'], 'rule'))->toBe(['required'])
        ->and($start['server'])->toBeTrue();
});

it('shows the message Laravel shows when the rule fails', function (array $rules, array $messages, array $attributes) {
    $sent = appRulesFor(['birthday' => $rules], $messages, $attributes)['birthday']['rules'];

    expect($sent)->toHaveCount(1)
        ->and($sent[0]['message'])->toBe(laravelFirstMessage($rules, '2024-02-30', $messages, $attributes));
})->with([
    'a Laravel rule' => [['date_format:Y-m-d'], [], []],
    'a Laravel rule with messages()' => [['date_format:Y-m-d'], ['birthday.date_format' => ':attribute needs :format.'], ['birthday' => 'date of birth']],
    'a named rule' => [['iso_date'], [], ['birthday' => 'date of birth']],
    'a named rule with messages()' => [['iso_date'], ['iso_date' => 'Pick a real day for :attribute.'], []],
    'a rule class' => [[new IsoDate], [], ['birthday' => 'date of birth']],
    'a rule class with a message for its class' => [[new IsoDate], [IsoDate::class => 'Not a day.'], []],
    'a rule class with a message for its short name' => [[new IsoDate], ['birthday.iso_date' => 'Pick a real :attribute.'], []],
    'a rule class with a message for the field' => [[new IsoDate], ['birthday' => 'Check the :attribute.'], []],
]);

it("fills in an extension's own message and its replacer, like Laravel", function () {
    Validator::extend('year_from', fn (string $attribute, mixed $value, array $parameters) => (int) $value >= (int) $parameters[0], 'The :attribute field must be :year or later.');
    Validator::replacer('year_from', fn (string $message, string $attribute, string $rule, array $parameters) => str_replace(':year', $parameters[0], $message));
    listAppRules(['year_from' => BrowserRule::class]);

    $sent = appRulesFor(['birthday' => ['year_from:2000']])['birthday']['rules'];

    expect($sent)->toBe([['rule' => 'year_from', 'params' => ['2000'], 'message' => 'The birthday field must be 2000 or later.']])
        ->and($sent[0]['message'])->toBe(laravelFirstMessage(['year_from:2000'], '1999'));
});

it('turns a built-in rule off with null, and replaces one with an entry of the same name', function () {
    listAppRules(['uuid' => null, 'email' => BrowserRule::class]);

    $schema = appRulesFor(['id' => ['required', 'uuid'], 'email' => ['email:dns']]);

    expect(array_column($schema['id']['rules'], 'rule'))->toBe(['required'])
        ->and($schema['id']['server'])->toBeTrue()
        ->and($schema['email']['rules'][0])->toMatchArray(['rule' => 'email', 'params' => ['dns']]);
});

it('only reads the rule classes the app lists', function () {
    $unlisted = new class implements ValidationRule
    {
        public function validate(string $attribute, mixed $value, Closure $fail): void {}
    };

    $schema = appRulesFor(['code' => ['required', new Checked], 'other' => ['required', $unlisted]]);

    expect($schema['code']['rules'][1])->toBe(['rule' => 'checked', 'params' => [], 'message' => 'The code field is wrong.'])
        ->and($schema['code']['server'])->toBeFalse()
        ->and(array_column($schema['other']['rules'], 'rule'))->toBe(['required'])
        ->and($schema['other']['server'])->toBeTrue();
});

it("leaves the rules the browser can't follow to the server", function () {
    Validator::extendImplicit('present_day', fn () => true);
    Validator::extendDependent('same_day', fn () => true);
    $implicit = new class extends Checked
    {
        public $implicit = true;
    };
    $implicitRule = new class extends Checked implements ImplicitRule
    {
        public function passes($attribute, $value)
        {
            return true;
        }

        public function message()
        {
            return 'Wrong.';
        }
    };
    $readsData = new class extends Checked implements DataAwareRule
    {
        public function setData(array $data): static
        {
            return $this;
        }
    };
    $readsValidator = new class extends Checked implements ValidatorAwareRule
    {
        public function setValidator(Illuminate\Validation\Validator $validator): static
        {
            return $this;
        }
    };
    listAppRules([
        'required_with' => BrowserRule::class,
        'filled' => BrowserRule::class,
        'present_day' => BrowserRule::class,
        'same_day' => BrowserRule::class,
        $implicit::class => CheckedBrowser::class,
        $implicitRule::class => CheckedBrowser::class,
        $readsData::class => CheckedBrowser::class,
        $readsValidator::class => CheckedBrowser::class,
    ]);

    $fields = [
        'with' => 'required_with:name',
        'filled' => 'filled',
        'implicit_extension' => 'present_day',
        'dependent_extension' => 'same_day:other',
        'implicit' => $implicit,
        'implicit_rule' => $implicitRule,
        'reads_data' => $readsData,
        'reads_validator' => $readsValidator,
        'unnamed' => new Checked(name: null),
        'no_message' => new Checked(message: null),
        'number' => new Checked(params: [5]),
        'keyed' => new Checked(params: ['a' => 'b']),
        'input' => new Checked(message: 'Not :input.'),
        'input_named' => 'iso_date',
    ];
    $schema = appRulesFor(array_map(fn (mixed $rule) => ['required', $rule], $fields), ['input_named.iso_date' => ':input is no date.']);

    foreach (array_keys($fields) as $field) {
        expect(array_column($schema[$field]['rules'], 'rule'))->toBe(['required'], $field)
            ->and($schema[$field]['server'])->toBeTrue();
    }
});

it("reports a listed entry that isn't a BrowserRule class, and leaves the form to plain Precognition", function () {
    Exceptions::fake();
    listAppRules(['iso_date' => stdClass::class]);

    expect(appRulesFor(['birthday' => ['iso_date']]))->toBeNull();
    Exceptions::assertReported(fn (InvalidArgumentException $e) => $e->getMessage() === 'precognition-plus.rules.iso_date has to be a BrowserRule class or null.');
});
