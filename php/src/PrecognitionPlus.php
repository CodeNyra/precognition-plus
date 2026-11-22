<?php

namespace CodeNyra\PrecognitionPlus;

use Closure;
use CodeNyra\PrecognitionPlus\Schema\SchemaBuilder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Factory;
use Illuminate\Validation\Validator;
use JsonException;
use ReflectionClass;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class PrecognitionPlus
{
    public const HEADER = 'Precognition-Rules';

    /** Caps for rules built from the input. A form over either one gets no rules. */
    public const MAX_FIELDS = 500;

    public const MAX_RULES_BYTES = 1024 * 1024;

    /** The request attribute that holds the built rules until the response is ready. */
    private const RULES = 'precognition-plus.rules';

    public static function capture(FormRequest $form, Request $request): void
    {
        if ($request->headers->get(static::HEADER) === 'true' && ! $request->attributes->has(static::HEADER)) {
            $request->attributes->set(static::HEADER, $form);
        }
    }

    /** Runs right after Laravel validates the form, while the request's middleware and locale still apply. */
    public static function build(Request $request): void
    {
        $form = $request->attributes->get(static::HEADER);

        if ($form instanceof FormRequest
            && ! $request->attributes->has(self::RULES)
            && $request->isPrecognitive()
            && config('precognition-plus.enabled')
            && static::reachedValidation($form)) {
            $request->attributes->set(self::RULES, static::schema($form));
        }
    }

    public static function attach(Request $request, Response $response): void
    {
        $schema = $request->attributes->get(self::RULES);
        $status = $response->getStatusCode();
        $content = $response->getContent(); // False for streamed responses.

        if (! is_array($schema) || ! in_array($status, [204, 422], true) || $content === false) {
            return;
        }

        // Add the rules to Laravel's JSON body, unless the app's response already has a rules key.
        $body = $status === 204 ? '{}' : rtrim($content);
        $object = json_decode($body);

        if (! is_object($object) || property_exists($object, 'rules')) {
            return;
        }

        try {
            $rules = json_encode($schema, JSON_THROW_ON_ERROR);
        } catch (JsonException $e) {
            report($e);

            return;
        }

        if (strlen($rules) > static::MAX_RULES_BYTES) {
            return;
        }

        if ($status === 204) {
            $response->setStatusCode(200);
        }

        // Keep the app's own JSON type, like application/problem+json.
        if (! str_contains(explode(';', (string) $response->headers->get('Content-Type'))[0], 'json')) {
            $response->headers->set('Content-Type', 'application/json');
        }

        $response->headers->remove('Content-Length');
        $response->headers->remove('ETag');
        $response->setVary(static::HEADER, false);
        $response->setContent(substr($body, 0, -1).(get_object_vars($object) === [] ? '' : ',').'"rules":'.$rules.'}');
    }

    /** Whether validation actually ran. authorize() and prepareForValidation() can also end in a 422. */
    protected static function reachedValidation(FormRequest $form): bool
    {
        $validator = Closure::bind(fn () => $this->validator, $form, FormRequest::class)();

        return $validator instanceof Validator && Closure::bind(fn () => $this->messages !== null, $validator, Validator::class)();
    }

    /** Whether the form or the app changes the input or the validation in ways the browser can't follow. */
    protected static function hasHooks(FormRequest $form): bool
    {
        $safe = ['__construct', 'messages', 'attributes', 'passedValidation', 'failedValidation', 'failedAuthorization', 'getRedirectUrl', 'validated', 'safe'];

        foreach ((new ReflectionClass($form))->getMethods() as $method) {
            if (is_subclass_of($method->class, FormRequest::class)
                && method_exists(FormRequest::class, $method->name)
                && ! in_array($method->name, $safe, true)) {
                return true;
            }
        }

        return method_exists($form, 'validator') || method_exists($form, 'withValidator') || method_exists($form, 'after')
            || Closure::bind(fn () => $this->stopOnFirstFailure
                || (method_exists($this, 'shouldFailOnUnknownFields') && $this->shouldFailOnUnknownFields()), $form, FormRequest::class)()
            || app('validator')::class !== Factory::class
            || Closure::bind(fn () => $this->resolver !== null, app('validator'), Factory::class)();
    }

    /**
     * The fields #[ServerOnly] names on the form's class, its parents and their traits.
     *
     * @return list<string>
     */
    protected static function serverOnly(FormRequest $form): array
    {
        $fields = [];

        foreach ([$form, ...class_parents($form), ...class_uses_recursive($form)] as $class) {
            foreach ((new ReflectionClass($class))->getAttributes(ServerOnly::class) as $attribute) {
                array_push($fields, ...$attribute->newInstance()->fields);
            }
        }

        return $fields;
    }

    /** @return array<string, array<string, mixed>>|null */
    public static function schema(FormRequest $form): ?array
    {
        try {
            if (static::hasHooks($form)) {
                return null;
            }

            [$rules, $messages, $attributes] = Closure::bind(
                fn () => [$this->validationRules(), $this->messages(), $this->attributes()],
                $form,
                FormRequest::class,
            )();

            if (count($rules) > static::MAX_FIELDS) {
                return null;
            }

            // Rules the app registered a replacer or extension for, under the names Laravel looks them up by.
            $changed = Closure::bind(
                fn () => array_map(Str::snake(...), array_keys([...$this->replacers, ...$this->extensions, ...$this->implicitExtensions, ...$this->dependentExtensions])),
                app('validator'),
                Factory::class,
            )();
            $builder = new SchemaBuilder(app('translator'), $changed, config('precognition-plus.rules', []), app('validator'));
            $schema = $builder->build($rules, $messages, $attributes);
            $private = static::serverOnly($form);

            foreach ($schema as $attribute => $field) {
                if (array_filter($private, fn (string $name) => Str::is([$name, "{$name}.*"], $attribute)) !== []) {
                    $schema[$attribute] = ['rules' => [], 'server' => true] + $field;
                }
            }

            // A field that isn't valid UTF-8 can't be JSON encoded, so leave it to the server.
            return array_filter($schema, fn (array $field, string|int $attribute) => json_encode([$attribute => $field]) !== false, ARRAY_FILTER_USE_BOTH);
        } catch (Throwable $e) {
            report($e);

            return null;
        }
    }
}
