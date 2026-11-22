<?php

namespace CodeNyra\PrecognitionPlus\Support;

/**
 * A regex the browser can run as is, because PHP and JavaScript read it the same way.
 *
 * @internal
 */
final class JavaScriptPattern
{
    /** The escapes both engines read alike (\d, \w, \s and their capitals, \n, \r, \t, \f, and punctuation). */
    private const ESCAPE = '\\\\(?:[dDwWsSnrtf]|[^A-Za-z0-9])';

    /** One token both engines read alike, like an escape, a class, a group, an anchor or a quantifier. */
    private const TOKEN = '/\G(?:'.self::ESCAPE.'|\\\\[bB]|\[(?!\^?\])(?:'.self::ESCAPE.'|[^\\\\\[\]])*\]'
        .'|\(\?[:=!]|\((?!\?)|\)(?![*+{])|[|^$.]|[*+?]\??(?!\+)|\{\d+(?:,\d*)?\}\??(?!\+)|[^\\\\\[\](){}*+?|^$.])/';

    /**
     * The RegExp source and flags (only i and s), or null when the server has to check the pattern.
     *
     * @return array{string, string}|null
     */
    public static function from(string $pattern): ?array
    {
        $delimiter = $pattern[0] ?? '';

        if ($delimiter === '' || ctype_alnum($delimiter) || $delimiter === '\\' || ctype_space($delimiter) || ! self::compiles($pattern)) {
            return null;
        }

        $closing = ['(' => ')', '{' => '}', '[' => ']', '<' => '>'][$delimiter] ?? $delimiter;
        $end = strrpos($pattern, $closing);

        if ($end === false || $end === 0) {
            return null;
        }

        $body = substr($pattern, 1, $end - 1);
        $flags = substr($pattern, $end + 1);

        return strspn($flags, 'is') === strlen($flags) && self::simple($body) ? [$body, $flags] : null;
    }

    /** Whether PHP compiles the pattern, without letting its warning reach the app's error handler. */
    private static function compiles(string $pattern): bool
    {
        set_error_handler(fn () => true);

        try {
            return preg_match($pattern, '') !== false;
        } finally {
            restore_error_handler();
        }
    }

    /**
     * Printable ASCII made of those tokens, with no repeated group and at most two quantifiers or
     * alternations. More can take JavaScript seconds where PHP stops at pcre.backtrack_limit.
     */
    private static function simple(string $body): bool
    {
        if (preg_match('/[^\x20-\x7E]/', $body)) {
            return false;
        }

        $choices = 0;

        for ($i = 0, $length = strlen($body); $i < $length; $i += strlen($token[0])) {
            if (! preg_match(self::TOKEN, $body, $token, 0, $i)) {
                return false;
            }

            $choices += preg_match('/^(?:[*+?|]|\{\d+,)/', $token[0]);
        }

        return $choices <= 2;
    }
}
