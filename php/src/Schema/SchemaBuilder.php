<?php

namespace CodeNyra\PrecognitionPlus\Schema;

use Illuminate\Contracts\Translation\Translator;
use Illuminate\Contracts\Validation\ParameterizedRule;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\ArrayKeys;
use Illuminate\Validation\Rules\ArrayRule;
use Illuminate\Validation\Rules\Contains;
use Illuminate\Validation\Rules\Date;
use Illuminate\Validation\Rules\DoesntContain;
use Illuminate\Validation\Rules\Enum;
use Illuminate\Validation\Rules\In;
use Illuminate\Validation\Rules\IpAddress;
use Illuminate\Validation\Rules\NotIn;
use Illuminate\Validation\Rules\NotRegex;
use Illuminate\Validation\Rules\Numeric;
use Illuminate\Validation\Rules\Regex;
use Illuminate\Validation\Rules\StringRule;
use Illuminate\Validation\ValidationRuleParser;
use Stringable;

/** @internal */
final class SchemaBuilder
{
    private const CLIENT_RULES = [
        'Required', 'String', 'Numeric', 'Integer', 'Boolean', 'Accepted', 'Declined',
        'Min', 'Max', 'Between', 'Size', 'Digits', 'DigitsBetween', 'MinDigits', 'MaxDigits', 'Decimal',
        'Email', 'Regex', 'NotRegex', 'In', 'NotIn', 'Enum', 'Confirmed',
        'Alpha', 'AlphaDash', 'AlphaNum', 'Lowercase', 'Uppercase',
        'StartsWith', 'EndsWith', 'DoesntStartWith', 'DoesntEndWith', 'Uuid', 'Ulid', 'File', 'Extensions',
    ];

    private const MODIFIERS = ['Nullable', 'Bail', 'Sometimes'];

    /** Rules that check something else with parameters, like integer:strict or uuid:4. Those go to the server. */
    private const NO_PARAMS = ['Required', 'String', 'Numeric', 'Integer', 'Boolean', 'Uuid'];

    /** Rules whose first parameter is another field, as in required_if:type,business. */
    private const FIRST_PARAMETER_IS_A_FIELD = [
        'After', 'AfterOrEqual', 'Before', 'BeforeOrEqual', 'DateEquals', 'Different', 'Same',
        'Gt', 'Gte', 'Lt', 'Lte', 'InArray', 'AcceptedIf', 'DeclinedIf',
        'RequiredIf', 'RequiredIfAccepted', 'RequiredIfDeclined', 'RequiredUnless',
        'ExcludeIf', 'ExcludeUnless', 'ExcludeWith', 'ExcludeWithout',
        'PresentIf', 'PresentUnless', 'MissingIf', 'MissingUnless',
        'ProhibitedIf', 'ProhibitedIfAccepted', 'ProhibitedIfDeclined', 'ProhibitedUnless',
    ];

    /** Rules whose parameters are all other fields, as in required_with:email,phone. */
    private const EVERY_PARAMETER_IS_A_FIELD = [
        'RequiredWith', 'RequiredWithAll', 'RequiredWithout', 'RequiredWithoutAll',
        'PresentWith', 'PresentWithAll', 'MissingWith', 'MissingWithAll', 'Prohibits',
    ];

    public function __construct(private readonly Translator $translator) {}

    /**
     * @param  array<string, mixed>  $rules
     * @param  array<string, string>  $messages
     * @param  array<string, string>  $attributes
     * @return array<string, array{rules: list<array<string, mixed>>, server: bool, nullable: bool, type: string, depends?: list<string>, values?: array<string, string>}>
     */
    public function build(array $rules, array $messages = [], array $attributes = []): array
    {
        $resolver = new MessageResolver($this->translator, $messages, $attributes);
        $schema = [];

        foreach ($rules as $attribute => $fieldRules) {
            if (! str_contains($attribute, '*')) {
                $schema[$attribute] = $this->field($attribute, $this->explode($fieldRules), $resolver);
            }
        }

        return $schema;
    }

    private function explode(mixed $rules): array
    {
        if (is_string($rules)) {
            return explode('|', $rules);
        }

        $exploded = [];

        foreach (Arr::wrap($rules) as $rule) {
            array_push($exploded, ...$this->stringRules($rule));
        }

        return $exploded;
    }

    /**
     * The string rules a rule object stands for, read the way Laravel's ValidationRuleParser reads
     * them, and Rule::enum() as an enum rule with its values. Other objects stay as they are and go
     * to the server. They run code of their own (closures, Password, your Rule classes), or their
     * string depends on a condition (Rule::requiredIf()) that the browser would only learn once.
     *
     * @return list<mixed>
     */
    private function stringRules(mixed $rule): array
    {
        return match (true) {
            $rule instanceof ArrayRule, $rule instanceof Date, $rule instanceof Numeric, $rule instanceof StringRule => explode('|', (string) $rule),
            $rule instanceof In, $rule instanceof NotIn, $rule instanceof Regex, $rule instanceof NotRegex,
            $rule instanceof Contains, $rule instanceof DoesntContain, $rule instanceof ArrayKeys, $rule instanceof IpAddress => [(string) $rule],
            $rule instanceof Enum && $rule instanceof Stringable && (string) $rule !== 'in:' => ['enum:'.Str::after((string) $rule, 'in:')],
            default => [$rule],
        };
    }

    private function field(string $attribute, array $rules, MessageResolver $resolver): array
    {
        $server = false;
        $nullable = false;
        $depends = [];
        $parsed = [];

        foreach ($rules as $rule) {
            // Laravel 13's ParameterizedRule objects (Rule::confirmed(), Rule::requiredWith(...)) parse like strings.
            if (! is_string($rule) && ! $rule instanceof ParameterizedRule) {
                $server = true;

                continue;
            }

            [$name, $parameters] = ValidationRuleParser::parse($rule);

            if ($name !== '') {
                $parsed[] = [$name, $parameters, $rule];
            }
        }

        $resolver->useRules($attribute, array_column($parsed, 2));
        $names = array_column($parsed, 0);
        $client = [];

        foreach ($parsed as [$name, $parameters]) {
            array_push($depends, ...$this->fieldsNamedBy($name, $parameters));

            if (in_array($name, self::MODIFIERS, true)) {
                $nullable = $nullable || $name === 'Nullable';

                continue;
            }

            $clientRule = $this->clientRule($attribute, $name, $parameters, $names);

            if ($clientRule === null) {
                $server = true;

                continue;
            }

            $client[] = $clientRule + ['message' => $resolver->messageFor($attribute, $name, $parameters)];
        }

        $field = [
            'rules' => $client,
            'server' => $server,
            'nullable' => $nullable,
            'type' => $resolver->sizeType($attribute),
        ];

        if ($depends !== []) {
            $field['depends'] = array_values(array_unique($depends));
        }

        $usesInput = array_filter(array_column($client, 'message'), fn (string $message) => str_contains($message, ':input'));

        if ($usesInput && $values = $resolver->valueNames($attribute)) {
            $field['values'] = $values;
        }

        return $field;
    }

    /**
     * The other fields a rule reads. The browser asks the server again when one of them changes,
     * since the answer for this field can change with it.
     *
     * @return list<string>
     */
    private function fieldsNamedBy(string $name, array $parameters): array
    {
        if (in_array($name, self::EVERY_PARAMETER_IS_A_FIELD, true)) {
            return array_map('strval', $parameters);
        }

        $field = (string) ($parameters[0] ?? '');

        if ($field === '' || ! in_array($name, self::FIRST_PARAMETER_IS_A_FIELD, true)) {
            return [];
        }

        if (in_array($name, ['Gt', 'Gte', 'Lt', 'Lte'], true) && is_numeric($field)) {
            return [];
        }

        return [Str::before($field, '.*')];
    }

    /**
     * @param  list<string>  $names  All the rules of the field.
     * @return array{rule: string, params: list<string>}|null
     */
    private function clientRule(string $attribute, string $name, array $parameters, array $names): ?array
    {
        if (! in_array($name, self::CLIENT_RULES, true)) {
            return null;
        }

        $parameters = array_map('strval', $parameters);
        $rule = ['rule' => Str::snake($name), 'params' => $parameters];

        return match (true) {
            in_array($name, self::NO_PARAMS, true) => $parameters === [] ? $rule : null,
            // Laravel's in checks a list item by item only with the array rule, not with list.
            in_array($name, ['In', 'NotIn'], true) && in_array('List', $names, true) && ! in_array('Array', $names, true) => null,
            $name === 'Email' => array_diff($parameters, ['rfc']) === [] ? $rule : null,
            $name === 'Confirmed' => ['rule' => 'confirmed', 'params' => [$parameters[0] ?? $attribute.'_confirmation']],
            $name === 'Regex', $name === 'NotRegex' => $this->regex($rule['rule'], $parameters[0] ?? ''),
            default => $rule,
        };
    }

    private function regex(string $rule, string $pattern): ?array
    {
        $delimiter = $pattern[0] ?? '';

        if ($delimiter === '' || ctype_alnum($delimiter) || $delimiter === '\\' || ctype_space($delimiter)) {
            return null;
        }

        $closing = ['(' => ')', '{' => '}', '[' => ']', '<' => '>'][$delimiter] ?? $delimiter;
        $end = strrpos($pattern, $closing);

        if ($end === false || $end === 0) {
            return null;
        }

        $flags = substr($pattern, $end + 1);

        if (strspn($flags, 'imsu') !== strlen($flags)) {
            return null;
        }

        $body = $this->javascriptBody(substr($pattern, 1, $end - 1), $flags);

        return $body === null ? null : ['rule' => $rule, 'params' => [$body, $flags]];
    }

    /**
     * The pattern for JavaScript's RegExp, or null when JavaScript would read it differently:
     * POSIX classes, escapes only PCRE has (\K, \h, \x{...}), \p without the u flag, or a class
     * that starts with ].
     */
    private function javascriptBody(string $body, string $flags): ?string
    {
        if (preg_match('/\[:\^?[a-z]+:\]|\[\^?\]/', $body)) {
            return null;
        }

        $supported = true;

        $body = preg_replace_callback('/\\\\(x\{|.)/s', function (array $match) use ($flags, &$supported): string {
            [$escape, $char] = $match;

            if (in_array($char, ['A', 'z', 'Z'], true) && ! str_contains($flags, 'm')) {
                return $char === 'A' ? '^' : '$';
            }

            $same = ($char !== 'x{' && (! ctype_alnum($char) || str_contains('dDwWsSbBnrtfx0123456789', $char)))
                || (in_array($char, ['p', 'P'], true) && str_contains($flags, 'u'));

            $supported = $supported && $same;

            return $escape;
        }, $body);

        return $supported ? $body : null;
    }
}
