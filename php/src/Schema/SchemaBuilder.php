<?php

namespace CodeNyra\PrecognitionPlus\Schema;

use Closure;
use CodeNyra\PrecognitionPlus\BrowserRule;
use CodeNyra\PrecognitionPlus\BrowserRules;
use Illuminate\Contracts\Translation\Translator;
use Illuminate\Support\Str;
use Illuminate\Translation\Translator as FileTranslator;
use Illuminate\Validation\Factory;
use Illuminate\Validation\Rules\Enum;
use Stringable;

/** @internal */
final class SchemaBuilder
{
    private const MODIFIERS = ['Nullable', 'Bail', 'Sometimes'];

    private const DATE_COMPARISONS = ['After', 'AfterOrEqual', 'Before', 'BeforeOrEqual', 'DateEquals'];

    /**
     * @param  list<string>  $changed  The rules the app registered a replacer or extension for, in snake_case.
     * @param  array<string, class-string<BrowserRule>|null>  $rules  The app's own browser rules, from config.
     * @param  Factory|null  $factory  The app's validator factory, for its extensions' messages and replacers.
     */
    public function __construct(
        private readonly Translator $translator,
        private readonly array $changed = [],
        private readonly array $rules = [],
        private readonly ?Factory $factory = null,
    ) {}

    /**
     * @param  array<string, mixed>  $rules
     * @param  array<string, string>  $messages
     * @param  array<string, string>  $attributes
     * @return array<string, array{rules: list<array<string, mixed>>, server: bool, nullable: bool, type: string, sometimes?: true, depends?: list<string>}>
     */
    public function build(array $rules, array $messages = [], array $attributes = []): array
    {
        $handled = $this->handleMissingKeys(false);

        try {
            return $this->fields($rules, $messages, $attributes);
        } finally {
            $this->handleMissingKeys($handled);
        }
    }

    /** Building looks up messages Laravel never shows, so the app's missing-key callback is paused meanwhile. */
    private function handleMissingKeys(bool $handle): bool
    {
        if (! $this->translator instanceof FileTranslator) {
            return $handle;
        }

        return Closure::bind(function () use ($handle) {
            [$handled, $this->handleMissingTranslationKeys] = [$this->handleMissingTranslationKeys, $handle];

            return $handled;
        }, $this->translator, FileTranslator::class)();
    }

    private function fields(array $rules, array $messages, array $attributes): array
    {
        $resolver = new MessageResolver($this->translator, $messages, $attributes, $this->factory);
        $read = array_map(fn (mixed $fieldRules) => RuleReader::read($fieldRules, array_keys($this->rules)), $rules);
        $starred = [];
        $skipping = [];

        // Collect the top-level names that have a * key, and the keys that may skip, by top-level name.
        foreach ($read as $key => [, , $skips]) {
            if (str_contains((string) $key, '*')) {
                $starred[self::top((string) $key)] = true;
            }

            if ($skips) {
                $skipping[self::top((string) $key)][] = (string) $key;
            }
        }

        $excludes = fn (string $top) => isset($skipping[$top]) || isset($skipping['*']) || ($top === '*' && $skipping !== []);
        $schema = [];

        foreach ($read as $attribute => [$fieldRules, $server, $skips]) {
            $attribute = (string) $attribute;
            $top = self::top($attribute);

            // Leave the field out, so it goes to the server every time, when a * key may add rules
            // to it or a skipping key may change it.
            if (str_contains($attribute, '*')
                || isset($starred['*'])
                || (str_contains($attribute, '.') && isset($starred[$top]))
                || array_diff(array_merge($skipping[$top] ?? [], $skipping['*'] ?? []), [$attribute]) !== []) {
                continue;
            }

            // Laravel resolves dates like now when the request comes in, so the result changes over time.
            if (array_intersect(array_column($fieldRules, 0), self::DATE_COMPARISONS) !== []) {
                continue;
            }

            $field = $this->field($attribute, $fieldRules, $server, $skips, $resolver);

            // Leave out fields whose rules read a field Laravel may exclude from the data.
            if (array_filter($field['depends'] ?? [], fn (string $path) => $excludes(self::top($path))) === []) {
                $schema[$attribute] = $field;
            }
        }

        return $schema;
    }

    /** The first segment, or * if it contains one, since that can match anything. */
    private static function top(string $name): string
    {
        $top = explode('.', $name)[0];

        return str_contains($top, '*') ? '*' : $top;
    }

    /** @param  list<array{string, list<mixed>, mixed}>  $rules */
    private function field(string $attribute, array $rules, bool $server, bool $skips, MessageResolver $resolver): array
    {
        // The app's rule classes play no part in the size type, and Laravel's parser can't read them.
        $resolver->useRules($attribute, array_column(array_filter($rules, fn (array $read) => ! self::isClass($read[0], $read[2])), 2));
        $field = new Field($attribute, $resolver->sizeType($attribute));
        $nullable = false;
        $sometimes = false;
        $depends = [];
        $client = [];

        foreach ($rules as [$name, $parameters, $rule]) {
            // A parameter that isn't text, like an array from an app's rule object, sends the field to the server.
            if (! self::isText($parameters)) {
                $server = true;

                continue;
            }

            array_push($depends, ...Dependencies::of($name, $parameters, $attribute));

            if (in_array($name, self::MODIFIERS, true)) {
                $nullable = $nullable || $name === 'Nullable';
                $sometimes = $sometimes || $name === 'Sometimes';

                continue;
            }

            // Leave it to the server when Laravel may skip the rules.
            $entry = $skips ? null : $this->browserEntry($attribute, $name, $parameters, $rule, $field, $resolver);

            if ($entry === null) {
                $server = true;

                continue;
            }

            $client[] = $entry;
        }

        $schema = ['rules' => $client, 'server' => $server, 'nullable' => $nullable, 'type' => $field->type];

        if ($sometimes) {
            $schema['sometimes'] = true;
        }

        if ($depends !== []) {
            $schema['depends'] = array_values(array_unique($depends));
        }

        return $schema;
    }

    /**
     * The rule as the browser gets it, or null when it stays on the server.
     *
     * @param  list<mixed>  $parameters
     * @return array{rule: string, params: list<string>, message: string}|null
     */
    private function browserEntry(string $attribute, string $name, array $parameters, mixed $rule, Field $field, MessageResolver $resolver): ?array
    {
        $class = self::isClass($name, $rule);
        $listed = array_key_exists($class ? $name : Str::snake($name), $this->rules);

        // Leave it to the server when a parameter isn't a string (compared strictly since 12.67 and
        // 13.26), or the app registered a replacer or extension, unless it also lists the rule and
        // so gives its browser half.
        if (array_filter($parameters, 'is_string') !== $parameters
            || (! $listed && in_array(Str::snake($rule instanceof Enum ? $rule::class : $name), $this->changed, true))) {
            return null;
        }

        // The browser can't run a listed rule Laravel runs on empty fields, apart from the built-in
        // ones, or an extension that reads other fields.
        if ($listed && ! $class && BrowserRules::named($name) === null
            && ($resolver->runsOnEmpty($name) || $resolver->readsOtherFields($name))) {
            return null;
        }

        $browser = BrowserRules::find($name, $rule, $this->rules);
        $params = $browser?->parameters($parameters, $field);

        if ($params === null || ! array_is_list($params) || array_filter($params, 'is_string') !== $params) {
            return null;
        }

        // Only build messages for browser rules, since a replacer can fail on others, like min without
        // a parameter. A rule class names its check and gives its message in its browser rule, since
        // Laravel only learns the message from $fail().
        if ($class) {
            [$browserName, $text] = [$browser->name(), $browser->message()];
            $message = $browserName === null || $text === null ? null : $resolver->objectMessageFor($attribute, $rule, [$text]);
        } else {
            $browserName = Str::snake($name);
            $message = $rule instanceof Enum
                ? $resolver->enumMessageFor($attribute, $rule)
                : $resolver->messageFor($attribute, $name, $parameters);
        }

        return $message === null ? null : ['rule' => $browserName, 'params' => $params, 'message' => $message];
    }

    /** Whether RuleReader read this as one of the app's rule classes, which it names by class. */
    private static function isClass(string $name, mixed $rule): bool
    {
        return is_object($rule) && $rule::class === $name;
    }

    private static function isText(array $parameters): bool
    {
        foreach ($parameters as $parameter) {
            if (is_array($parameter) || (is_object($parameter) && ! $parameter instanceof Stringable)) {
                return false;
            }
        }

        return true;
    }
}
