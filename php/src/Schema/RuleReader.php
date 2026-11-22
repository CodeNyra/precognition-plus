<?php

namespace CodeNyra\PrecognitionPlus\Schema;

use BackedEnum;
use Illuminate\Contracts\Validation\CompilableRules;
use Illuminate\Contracts\Validation\DataAwareRule;
use Illuminate\Contracts\Validation\ImplicitRule;
use Illuminate\Contracts\Validation\ParameterizedRule;
use Illuminate\Contracts\Validation\ValidatorAwareRule;
use Illuminate\Support\Arr;
use Illuminate\Validation\ConditionalRules;
use Illuminate\Validation\Rules\ArrayKeys;
use Illuminate\Validation\Rules\ArrayRule;
use Illuminate\Validation\Rules\Contains;
use Illuminate\Validation\Rules\Date;
use Illuminate\Validation\Rules\DoesntContain;
use Illuminate\Validation\Rules\Enum;
use Illuminate\Validation\Rules\ExcludeIf;
use Illuminate\Validation\Rules\ExcludeUnless;
use Illuminate\Validation\Rules\In;
use Illuminate\Validation\Rules\IpAddress;
use Illuminate\Validation\Rules\NotIn;
use Illuminate\Validation\Rules\NotRegex;
use Illuminate\Validation\Rules\Numeric;
use Illuminate\Validation\Rules\Regex;
use Illuminate\Validation\Rules\StringRule;
use Illuminate\Validation\ValidationRuleParser;
use ReflectionEnum;
use ReflectionProperty;

/** @internal */
final class RuleReader
{
    /**
     * The rules as [name, parameters, rule], parsed the way Laravel does, plus whether any need the
     * server and whether any can make Laravel skip the rest, like exclude_if, Rule::when() or
     * Rule::forEach().
     *
     * @param  list<string>  $classes  The rule classes the app lists in config, read by their class name.
     * @return array{list<array{string, list<mixed>, mixed}>, bool, bool}
     */
    public static function read(mixed $rules, array $classes = []): array
    {
        $read = [];
        $server = false;
        $skips = false;

        foreach (self::explode($rules) as $rule) {
            $skips = $skips || $rule instanceof ConditionalRules || $rule instanceof ExcludeIf || $rule instanceof ExcludeUnless
                || $rule instanceof CompilableRules;

            // Only Laravel's own Rules\Enum goes to the browser, and only for a backed enum.
            if (is_object($rule) && $rule::class === Enum::class && ($parameters = self::enum($rule)) !== null) {
                $read[] = ['Enum', $parameters, $rule];

                continue;
            }

            // A rule class the app lists is read by its class name.
            if (is_object($rule) && in_array($rule::class, $classes, true) && ! self::readsMore($rule)) {
                $read[] = [$rule::class, [], $rule];

                continue;
            }

            // ParameterizedRule objects, like Laravel 13's Rule::confirmed(), parse like strings.
            if (! is_string($rule) && ! is_array($rule) && ! $rule instanceof ParameterizedRule) {
                $server = true;

                continue;
            }

            [$name, $parameters] = ValidationRuleParser::parse($rule);
            $skips = $skips || str_starts_with($name, 'Exclude');

            // Laravel has no string version of the enum rule.
            if ($name === 'Enum') {
                $server = true;
            } elseif ($name !== '') {
                $read[] = [$name, $parameters, $rule];
            }
        }

        return [$read, $server, $skips];
    }

    private static function explode(mixed $rules): array
    {
        if (is_string($rules)) {
            return explode('|', $rules);
        }

        $exploded = [];

        foreach (Arr::wrap($rules) as $rule) {
            array_push($exploded, ...self::strings($rule));
        }

        return $exploded;
    }

    /** A rule object as the string rules it stands for. Rule::requiredIf() stays an object, since its string bakes in one request's answer. */
    private static function strings(mixed $rule): array
    {
        return match (true) {
            $rule instanceof ArrayRule, $rule instanceof Date, $rule instanceof Numeric, $rule instanceof StringRule => explode('|', (string) $rule),
            $rule instanceof In, $rule instanceof NotIn, $rule instanceof Regex, $rule instanceof NotRegex,
            $rule instanceof Contains, $rule instanceof DoesntContain, $rule instanceof ArrayKeys, $rule instanceof IpAddress => [(string) $rule],
            default => [$rule],
        };
    }

    /**
     * Whether Laravel runs the rule on empty fields, the way InvokableValidationRule::make() reads
     * $implicit, or hands it the data or the validator. The browser can't follow those yet.
     */
    private static function readsMore(object $rule): bool
    {
        return $rule instanceof ImplicitRule || ($rule->implicit ?? false)
            || $rule instanceof DataAwareRule || $rule instanceof ValidatorAwareRule;
    }

    /**
     * The backing type and the values the rule accepts after only() and except(), or null for a
     * pure enum or one with more than 1,000 cases.
     *
     * @return list<string>|null
     */
    private static function enum(Enum $rule): ?array
    {
        $type = (new ReflectionProperty($rule, 'type'))->getValue($rule);
        $backing = enum_exists($type) ? (new ReflectionEnum($type))->getBackingType()?->getName() : null;

        if ($backing === null || count($type::cases()) > 1000) {
            return null;
        }

        $accepted = array_filter($type::cases(), fn (BackedEnum $case) => $rule->passes('', $case->value));

        return [$backing, ...array_map(fn (BackedEnum $case) => (string) $case->value, $accepted)];
    }
}
