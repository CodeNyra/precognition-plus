<?php

namespace CodeNyra\PrecognitionPlus\Schema;

use Illuminate\Support\Str;

/** @internal */
final class Dependencies
{
    private const FIRST_PARAMETER_IS_A_FIELD = [
        'Same', 'Gt', 'Gte', 'Lt', 'Lte', 'InArray', 'AcceptedIf', 'DeclinedIf',
        'RequiredIf', 'RequiredIfAccepted', 'RequiredIfDeclined', 'RequiredUnless',
        'ExcludeIf', 'ExcludeUnless', 'ExcludeWith',
        'PresentIf', 'PresentUnless', 'MissingIf', 'MissingUnless',
        'ProhibitedIf', 'ProhibitedIfAccepted', 'ProhibitedIfDeclined', 'ProhibitedUnless',
    ];

    private const EVERY_PARAMETER_IS_A_FIELD = [
        'RequiredWith', 'RequiredWithAll', 'RequiredWithout', 'RequiredWithoutAll',
        'PresentWith', 'PresentWithAll', 'MissingWith', 'MissingWithAll', 'Prohibits',
        'Different', 'ExcludeWithout',
    ];

    /**
     * The other fields a rule reads. The browser asks the server again when one of them changes.
     *
     * @return list<string>
     */
    public static function of(string $name, array $parameters, string $attribute): array
    {
        // confirmed reads <field>_confirmation, unless it names another field.
        if ($name === 'Confirmed') {
            return [(string) ($parameters[0] ?? "{$attribute}_confirmation")];
        }

        if (in_array($name, self::EVERY_PARAMETER_IS_A_FIELD, true)) {
            return array_map('strval', $parameters);
        }

        // unique reads the id to ignore from another field when that's written in brackets, like [id].
        if ($name === 'Unique') {
            return preg_match('/\[(.*)\]/', (string) ($parameters[2] ?? ''), $match) ? [$match[1]] : [];
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
}
