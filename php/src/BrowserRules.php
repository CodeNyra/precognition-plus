<?php

namespace CodeNyra\PrecognitionPlus;

use Illuminate\Support\Str;
use InvalidArgumentException;

/**
 * The rules the browser can check, kept in sync with js/src/browser_rules.ts. An app can add its own in
 * config, and anything else stays on the server.
 *
 * @internal
 */
final class BrowserRules
{
    /** Keyed by the names Laravel's ValidationRuleParser gives them. */
    private const RULES = [
        'Accepted' => Rules\Accepted::class,
        'Alpha' => Rules\Alpha::class,
        'AlphaDash' => Rules\AlphaDash::class,
        'AlphaNum' => Rules\AlphaNum::class,
        'Between' => Rules\Between::class,
        'Boolean' => Rules\Boolean::class,
        'Confirmed' => Rules\Confirmed::class,
        'Decimal' => Rules\Decimal::class,
        'Declined' => Rules\Declined::class,
        'Digits' => Rules\Digits::class,
        'DigitsBetween' => Rules\DigitsBetween::class,
        'DoesntEndWith' => Rules\DoesntEndWith::class,
        'DoesntStartWith' => Rules\DoesntStartWith::class,
        'Email' => Rules\Email::class,
        'EndsWith' => Rules\EndsWith::class,
        'Enum' => Rules\Enum::class,
        'In' => Rules\In::class,
        'Integer' => Rules\Integer::class,
        'Lowercase' => Rules\Lowercase::class,
        'Max' => Rules\Max::class,
        'MaxDigits' => Rules\MaxDigits::class,
        'Min' => Rules\Min::class,
        'MinDigits' => Rules\MinDigits::class,
        'NotIn' => Rules\NotIn::class,
        'NotRegex' => Rules\NotRegex::class,
        'Numeric' => Rules\Numeric::class,
        'Regex' => Rules\Regex::class,
        'Required' => Rules\Required::class,
        'Size' => Rules\Size::class,
        'StartsWith' => Rules\StartsWith::class,
        'String' => Rules\StringRule::class,
        'Ulid' => Rules\Ulid::class,
        'Uppercase' => Rules\Uppercase::class,
        'Uuid' => Rules\Uuid::class,
    ];

    public static function named(string $name): ?BrowserRule
    {
        $class = self::RULES[$name] ?? null;

        return $class === null ? null : new $class;
    }

    /**
     * The browser rule for a rule as RuleReader reads it. The app's own list comes first, by class
     * for a rule class and by snake_case name otherwise, and null there keeps a built-in rule on
     * the server.
     *
     * @param  array<string, class-string<BrowserRule>|null>  $app
     */
    public static function find(string $name, mixed $rule, array $app): ?BrowserRule
    {
        $class = is_object($rule) && $rule::class === $name;
        $key = $class ? $name : Str::snake($name);

        if (! array_key_exists($key, $app)) {
            return $class ? null : self::named($name);
        }

        $browser = $app[$key];

        if ($browser === null) {
            return null;
        }

        if (! is_string($browser) || ! is_a($browser, BrowserRule::class, true)) {
            throw new InvalidArgumentException("precognition-plus.rules.{$key} has to be a BrowserRule class or null.");
        }

        return $class ? new $browser($rule) : new $browser;
    }
}
