<?php

use CodeNyra\PrecognitionPlus\PrecognitionPlus;
use CodeNyra\PrecognitionPlus\ServerOnly;
use CodeNyra\PrecognitionPlus\Tests\Fixtures\CheckoutRequest;
use CodeNyra\PrecognitionPlus\Tests\Fixtures\CouponRequest;
use CodeNyra\PrecognitionPlus\Tests\Fixtures\FlakyRequest;
use CodeNyra\PrecognitionPlus\Tests\Fixtures\HookedChildRequest;
use CodeNyra\PrecognitionPlus\Tests\Fixtures\KeepsCouponPrivate;
use CodeNyra\PrecognitionPlus\Tests\Fixtures\PeekingRequest;
use CodeNyra\PrecognitionPlus\Tests\Fixtures\PrivateCouponRequest;
use CodeNyra\PrecognitionPlus\Tests\Fixtures\ScopesCoupons;
use CodeNyra\PrecognitionPlus\Tests\Fixtures\SetsLocaleBriefly;
use CodeNyra\PrecognitionPlus\Tests\Fixtures\StoreUserRequest;
use CodeNyra\PrecognitionPlus\Tests\Fixtures\UserController;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Foundation\Http\Middleware\HandlePrecognitiveRequests;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Exceptions;
use Illuminate\Support\Facades\Route;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

beforeEach(function () {
    UserController::$ran = false;

    Route::middleware(HandlePrecognitiveRequests::class)->group(function () {
        Route::post('/users', [UserController::class, 'store']);
        Route::put('/users/{user}', [UserController::class, 'update']);
        Route::post('/users/{user}/transfer', [UserController::class, 'transfer']);
        Route::post('/join', [UserController::class, 'join']);
        Route::post('/redeem', [UserController::class, 'redeem']);
        Route::post('/labels', [UserController::class, 'label']);
        Route::post('/shapes', [UserController::class, 'shape']);
        Route::post('/pages', [UserController::class, 'page']);
        Route::post('/localized', [UserController::class, 'store'])->middleware(SetsLocaleBriefly::class);
        Route::post('/settings', [UserController::class, 'localize']);
        Route::post('/coupons', [UserController::class, 'coupon'])->middleware(ScopesCoupons::class);
        Route::post('/closure', fn (StoreUserRequest $request) => 'stored');
        Route::post('/peek', fn (PeekingRequest $request) => 'peeked');
        Route::post('/flaky', fn (FlakyRequest $request) => 'stored');
        Route::post('/quiet', fn (CouponRequest $request) => response()->noContent());
        Route::post('/private', fn (PrivateCouponRequest $request) => 'stored');
    });
});

// Adds the rules to an answer for a form that passed, the way the listener does.
$attach = function (Response $response, array $rules = ['name' => 'nullable']): Response {
    $form = (new class($rules) extends FormRequest
    {
        public function __construct(private array $given)
        {
            parent::__construct();
        }

        public function rules(): array
        {
            return $this->given;
        }
    })->setContainer(app())->setRedirector(app('redirect'));
    $form->validateResolved();

    $request = Request::create('/x', 'POST');
    $request->attributes->set('precognitive', true);
    $request->attributes->set(PrecognitionPlus::HEADER, $form);
    PrecognitionPlus::build($request);
    PrecognitionPlus::attach($request, $response);

    return $response;
};

$precognitive = fn (string $only, bool $askForRules = true) => array_filter([
    'Accept' => 'application/json',
    'Precognition' => 'true',
    'Precognition-Validate-Only' => $only,
    'Precognition-Rules' => $askForRules ? 'true' : null,
]);

it('returns the rules with a 200 when the first request passes', function () use ($precognitive) {
    $response = $this->post('/users', ['name' => 'Taylor'], $precognitive('name'))
        ->assertOk()
        ->assertHeader('Precognition', 'true')
        ->assertHeader('Precognition-Success', 'true')
        ->assertHeader('Content-Type', 'application/json')
        ->assertJsonPath('rules.email.server', true);

    expect($response->json('rules'))->toHaveKeys(['name', 'email', 'password'])
        ->and($response->getContent())->not->toContain('unique')
        ->and(UserController::$ran)->toBeFalse();
});

it('adds the rules alongside validation errors', function () use ($precognitive) {
    $this->post('/users', ['username' => 'taken'], $precognitive('username'))
        ->assertStatus(422)
        ->assertJsonPath('errors.username.0', 'That username is taken.')
        ->assertJsonMissingPath('errors.name')
        ->assertJsonPath('rules.username.server', true);
});

it('builds the rules from the request being validated', function () use ($precognitive) {
    $this->put('/users/7', ['name' => 'Taylor'], $precognitive('name'))
        ->assertJsonPath('rules.name.rules.1.params', ['17']);
});

it('only sends rules when asked', function () use ($precognitive) {
    $this->put('/users/7', ['name' => 'Taylor'], $precognitive('name', askForRules: false))->assertNoContent();
    $this->put('/users/7', ['name' => 'Taylor'], [...$precognitive('name', askForRules: false), 'Precognition-Rules' => 'false'])
        ->assertNoContent();
});

it('never sends rules for a real submit', function () {
    $this->put('/users/7', ['name' => 'Taylor'], ['Precognition-Rules' => 'true'])->assertOk()->assertContent('updated');

    expect(UserController::$ran)->toBeTrue();
});

it('keeps #[ServerOnly] fields on the server', function () use ($precognitive) {
    $response = $this->post('/private', ['name' => 'Taylor'], $precognitive('name'))
        ->assertOk()
        ->assertJsonPath('rules.name.server', false)
        ->assertJsonPath('rules.coupon.rules', [])
        ->assertJsonPath('rules.coupon.server', true)
        ->assertJsonPath('rules.plan.rules.1.params', ['free', 'pro']);

    expect($response->getContent())->not->toContain('SECRET');
});

it('covers nested fields, and #[ServerOnly] on a parent class', function () {
    $form = (new #[ServerOnly('payment')] class extends PrivateCouponRequest
    {
        public function rules(): array
        {
            return [...parent::rules(), 'payments' => 'max:3'];
        }
    })->setContainer(app());
    $schema = PrecognitionPlus::schema($form);

    expect($schema['payment.card'])->toMatchArray(['rules' => [], 'server' => true])
        ->and($schema['coupon'])->toMatchArray(['rules' => [], 'server' => true])
        ->and($schema['payments']['rules'][0]['rule'])->toBe('max');
});

it('reads #[ServerOnly] from traits, arrays, repeats and wildcards', function () {
    $private = fn (FormRequest $form) => array_keys(array_filter(
        PrecognitionPlus::schema($form->setContainer(app())) ?? [],
        fn (array $field) => $field['rules'] === [],
    ));

    expect($private(new class extends CheckoutRequest
    {
        use KeepsCouponPrivate;
    }))->toBe(['coupon'])
        ->and($private(new #[ServerOnly(['coupon', 'plan'])] class extends CheckoutRequest {}))->toBe(['coupon', 'plan'])
        ->and($private(new #[ServerOnly('coupon')] #[ServerOnly('plan')] class extends CheckoutRequest {}))->toBe(['coupon', 'plan'])
        ->and($private(new #[ServerOnly('payment.*')] class extends CheckoutRequest {}))->toBe(['payment.card'])
        ->and($private(new #[ServerOnly('*')] class extends CheckoutRequest {}))->toBe(['name', 'coupon', 'payment', 'payment.card', 'plan']);
});

it('never sends rules for a real submit, even an empty 204', function () {
    $this->post('/quiet', ['coupon' => 'ACME-10'], ['Accept' => 'application/json', 'Precognition-Rules' => 'true'])
        ->assertNoContent();
});

it('reports errors while building the rules and still responds like Laravel', function () use ($precognitive) {
    Exceptions::fake();

    $this->post('/flaky', ['name' => 'Taylor'], $precognitive('name'))->assertNoContent();

    Exceptions::assertReported(fn (RuntimeException $e) => $e->getMessage() === 'Asked twice.');
});

it('sends no rules to users who fail authorization', function () use ($precognitive) {
    $this->post('/users/7/transfer', ['title' => 'x'], $precognitive('title'))
        ->assertForbidden()
        ->assertJsonMissingPath('rules');
});

it('sends no rules when the form fails before validation runs', function () use ($precognitive) {
    $this->post('/join', ['code' => 'x'], $precognitive('code'))
        ->assertStatus(422)
        ->assertJsonMissingPath('rules');

    $this->post('/redeem', ['code' => 'x'], $precognitive('code'))
        ->assertStatus(422)
        ->assertJsonPath('errors.code.0', 'Not yet.')
        ->assertJsonMissingPath('rules');
});

it('sends no rules when authorize() peeks at the validator and then fails', function () use ($precognitive) {
    $this->post('/peek', ['code' => 'x'], $precognitive('code'))
        ->assertStatus(422)
        ->assertJsonPath('errors.code.0', 'Not yet.')
        ->assertJsonMissingPath('rules');

    $this->post('/peek', ['code' => 'y'], $precognitive('code'))
        ->assertOk()
        ->assertJsonPath('rules.code.server', false);
});

it('builds no rules for more than 500 fields', function () {
    $form = fn (int $fields) => (new class($fields) extends FormRequest
    {
        public function __construct(private int $fields)
        {
            parent::__construct();
        }

        public function rules(): array
        {
            return array_fill_keys(array_map(fn (int $i) => "item$i", range(1, $this->fields)), 'required');
        }
    })->setContainer(app());

    expect(PrecognitionPlus::schema($form(500)))->toHaveCount(500)
        ->and(PrecognitionPlus::schema($form(501)))->toBeNull();
});

it("leaves fields that can't be JSON encoded to the server, without reporting them", function () use ($precognitive) {
    Exceptions::fake();

    $this->post('/labels', ['name' => 'Taylor'], $precognitive('name'))
        ->assertOk()
        ->assertJsonPath('rules.name.server', false)
        ->assertJsonMissingPath('rules.code');

    Exceptions::assertNothingReported();
});

it('builds no rules for forms that change their input or validation', function () {
    $hooked = [
        new class extends FormRequest
        {
            public function rules(): array
            {
                return ['phone' => 'required|digits:10'];
            }

            protected function prepareForValidation(): void
            {
                $this->merge(['phone' => preg_replace('/\D/', '', (string) $this->input('phone'))]);
            }
        },
        new class extends FormRequest
        {
            public function rules(): array
            {
                return ['name' => 'required'];
            }

            public function validationData(): array
            {
                return $this->all();
            }
        },
        new class extends FormRequest
        {
            public function rules(): array
            {
                return ['name' => 'required'];
            }

            public function withValidator($validator): void {}
        },
        new class extends FormRequest
        {
            public function rules(): array
            {
                return ['name' => 'required'];
            }

            public function after(): array
            {
                return [];
            }
        },
        new class extends FormRequest
        {
            protected $stopOnFirstFailure = true;

            public function rules(): array
            {
                return ['name' => 'required'];
            }
        },
        new class extends FormRequest
        {
            public function rules(): array
            {
                return ['name' => 'required'];
            }

            public function validator($factory)
            {
                return $factory->make($this->all(), $this->rules());
            }
        },
        new class extends FormRequest
        {
            public function rules(): array
            {
                return ['phone' => 'digits:10'];
            }

            public function all($keys = null)
            {
                return ['phone' => preg_replace('/\D/', '', (string) parent::input('phone'))];
            }
        },
        new class extends FormRequest
        {
            public function rules(): array
            {
                return ['phone' => 'digits:10'];
            }

            protected function getValidatorInstance()
            {
                $this->merge(['phone' => preg_replace('/\D/', '', (string) $this->input('phone'))]);

                return parent::getValidatorInstance();
            }
        },
        new HookedChildRequest,
    ];

    foreach ($hooked as $form) {
        expect(PrecognitionPlus::schema($form->setContainer(app())))->toBeNull();
    }
});

it('still builds rules for forms that only override messages(), attributes() and the like', function () {
    $form = new class extends FormRequest
    {
        public function __construct()
        {
            parent::__construct();
        }

        public function rules(): array
        {
            return ['name' => 'required'];
        }

        public function messages(): array
        {
            return ['name.required' => 'Name, please.'];
        }

        public function attributes(): array
        {
            return ['name' => 'full name'];
        }

        protected function passedValidation(): void {}

        protected function failedValidation($validator): void
        {
            parent::failedValidation($validator);
        }

        protected function failedAuthorization(): void
        {
            parent::failedAuthorization();
        }

        protected function getRedirectUrl()
        {
            return parent::getRedirectUrl();
        }

        public function validated($key = null, $default = null)
        {
            return parent::validated($key, $default);
        }

        public function safe(?array $keys = null)
        {
            return parent::safe($keys);
        }
    };

    expect(PrecognitionPlus::schema($form->setContainer(app())))->toHaveKey('name');
});

it('builds no rules for forms that check for unknown fields', function () {
    $form = new #[Illuminate\Foundation\Http\Attributes\FailOnUnknownFields] class extends FormRequest
    {
        public function rules(): array
        {
            return ['name' => 'required'];
        }
    };

    expect(PrecognitionPlus::schema($form->setContainer(app())))->toBeNull();
})->skip(! class_exists(Illuminate\Foundation\Http\Attributes\FailOnUnknownFields::class), 'Laravel releases that check for unknown fields');

it('leaves rules with custom extensions or class-based replacers to the server', function () {
    Illuminate\Support\Facades\Validator::extendImplicit('min', fn () => true);
    Illuminate\Support\Facades\Validator::extend('lowercase', fn () => true);
    Illuminate\Support\Facades\Validator::extendDependent('uppercase', fn () => true);
    Illuminate\Support\Facades\Validator::replacer(Illuminate\Validation\Rules\Enum::class, fn (string $message) => $message);
    $form = (new class extends FormRequest
    {
        public function rules(): array
        {
            return [
                'name' => 'min:3',
                'code' => 'lowercase',
                'tag' => 'uppercase',
                'plan' => [Illuminate\Validation\Rule::enum(CodeNyra\PrecognitionPlus\Tests\Fixtures\Plan::class)],
                'title' => 'max:3',
            ];
        }
    })->setContainer(app());
    $schema = PrecognitionPlus::schema($form);

    foreach (['name', 'code', 'tag', 'plan'] as $field) {
        expect($schema[$field])->toMatchArray(['rules' => [], 'server' => true]);
    }

    expect($schema['title']['rules'][0]['rule'])->toBe('max');
});

it('builds no rules when the app swaps the validator factory or resolver', function () {
    $form = fn () => (new StoreUserRequest)->setContainer(app());

    Illuminate\Support\Facades\Validator::resolver(fn (...$arguments) => new Illuminate\Validation\Validator(...$arguments));
    expect(PrecognitionPlus::schema($form()))->toBeNull();

    app()->instance('validator', new class(app('translator'), app()) extends Illuminate\Validation\Factory {});
    expect(PrecognitionPlus::schema($form()))->toBeNull();
});

it("adds the rules to the app's own response and leaves the rest untouched", function () use ($precognitive) {
    $response = $this->post('/shapes', [], $precognitive('name'))
        ->assertStatus(422)
        ->assertHeader('Content-Type', 'application/problem+json')
        ->assertHeaderMissing('Content-Length')
        ->assertHeaderMissing('ETag');

    // The body ends with a newline, and the rules go in before it.
    expect($response->getContent())->toStartWith('{"message":"Missing.","7":"x","3":"y","meta":{},"ratio":1.0,"errors":{"name":["Missing."]},"rules":{"name":')
        ->and(json_decode($response->getContent(), true))->toHaveKey('rules');
});

it('leaves responses that are not JSON objects alone', function () use ($precognitive) {
    $this->post('/pages', [], $precognitive('name'))
        ->assertStatus(422)
        ->assertContent('<p>Missing.</p>');
});

it('drops rules over 1 MB, which input-built rules can reach', function () use ($attach) {
    // About 10 KB of rules per field.
    $in = 'nullable|in:'.implode(',', array_map(fn (int $i) => str_pad((string) $i, 1000, 'x'), range(1, 10)));
    $rules = array_fill_keys(array_map(fn (int $i) => "rows.{$i}.country", range(1, 120)), $in);

    expect($attach(response()->noContent(), $rules)->getStatusCode())->toBe(204)
        ->and($attach(response()->noContent(), array_slice($rules, 0, 80))->getStatusCode())->toBe(200);
});

it('leaves streamed responses alone', function () use ($attach) {
    expect($attach(new StreamedResponse(fn () => null, 204))->getStatusCode())->toBe(204);
});

it('leaves a response alone when the app already sent a rules key', function () use ($attach) {
    $body = '{"errors":{"name":["Missing."]},"rules":"the app\'s"}';

    expect($attach(response($body, 422, ['Content-Type' => 'application/json']))->getContent())->toBe($body);
});

it('adds the rules header to Vary and only trusts the media type for JSON', function () use ($attach) {
    $response = $attach(response('{}', 422, ['Content-Type' => 'text/html; profile=json', 'Vary' => 'Precognition']));

    expect($response->getVary())->toBe(['Precognition', 'Precognition-Rules'])
        ->and($response->headers->get('Content-Type'))->toBe('application/json')
        ->and(json_decode($response->getContent(), true))->toHaveKey('rules');
});

it('builds the messages in the locale the form was resolved with', function () use ($precognitive) {
    app('translator')->addLines(['validation.required' => 'Das Feld :attribute ist erforderlich.'], 'de');

    $this->post('/localized', ['username' => 'taylor'], $precognitive('username'))
        ->assertOk()
        ->assertJsonPath('rules.username.rules.0.message', 'Das Feld handle ist erforderlich.');

    expect(app()->getLocale())->toBe('en');
});

it('uses a locale set in authorize() for the messages', function () use ($precognitive) {
    app('translator')->addLines(['validation.required' => 'Das Feld :attribute ist erforderlich.'], 'de');

    $this->post('/settings', [], $precognitive('name'))
        ->assertStatus(422)
        ->assertJsonPath('errors.name.0', 'Das Feld name ist erforderlich.')
        ->assertJsonPath('rules.name.rules.0.message', 'Das Feld name ist erforderlich.');
});

it("builds the messages in the translator's locale, even when it differs from the app's", function () {
    app('translator')->addLines(['validation.required' => 'Das Feld :attribute ist erforderlich.'], 'de');
    app('translator')->setLocale('de');

    expect(PrecognitionPlus::schema((new StoreUserRequest)->setContainer(app()))['email']['rules'][0]['message'])->toBe('Das Feld email ist erforderlich.')
        ->and(app()->getLocale())->toBe('en');
});

it('builds the rules while middleware state is still in place', function () use ($precognitive) {
    $this->post('/coupons', ['coupon' => 'ACME-10'], $precognitive('coupon'))
        ->assertOk()
        ->assertJsonPath('rules.coupon.rules.1.params', ['ACME-10']);
});

it('adds the rules for route closures too', function () use ($precognitive) {
    $this->post('/closure', ['name' => 'Taylor'], $precognitive('name'))
        ->assertOk()
        ->assertJsonPath('rules.name.server', false);
});

it('leaves rules with a custom message replacer to the server', function () {
    Exceptions::fake();
    Illuminate\Support\Facades\Validator::replacer('max', fn (string $message, string $attribute, string $rule, array $parameters, $validator) => $validator->getData()[$attribute].' is too long.');
    Illuminate\Support\Facades\Validator::replacer('required', 'App\Missing@replace');
    $form = (new class extends FormRequest
    {
        public function rules(): array
        {
            return ['name' => 'required|max:3', 'title' => 'string'];
        }
    })->setContainer(app());
    $schema = PrecognitionPlus::schema($form);

    expect($schema['name'])->toMatchArray(['rules' => [], 'server' => true])
        ->and($schema['title']['rules'][0]['rule'])->toBe('string');
    Exceptions::assertNothingReported();
});

it('sends no rules when disabled', function () use ($precognitive) {
    config(['precognition-plus.enabled' => false]);

    $this->post('/users', ['name' => 'Taylor'], $precognitive('name'))->assertNoContent();
});
