<?php

namespace CodeNyra\PrecognitionPlus\Schema;

use Illuminate\Contracts\Translation\Translator;
use Illuminate\Validation\Rules\Enum;
use Illuminate\Validation\Validator;

/** @internal */
final class MessageResolver extends Validator
{
    private const FILE_RULES = ['File', 'Image', 'Mimes', 'Mimetypes', 'Extensions'];

    public function __construct(Translator $translator, array $messages = [], array $attributes = [])
    {
        parent::__construct($translator, [], [], $messages, $attributes);
    }

    /** @param  list<mixed>  $rules  The field's rules in any form Laravel's parser takes (strings, arrays or objects). */
    public function useRules(string $attribute, array $rules): void
    {
        $this->rules = [$attribute => $rules];
    }

    /** @param  list<string>  $parameters */
    public function messageFor(string $attribute, string $rule, array $parameters): ?string
    {
        return self::withoutInput($this->makeReplacements($this->getMessage($attribute, $rule), $attribute, $rule, $parameters));
    }

    /** Rule::enum()'s message, looked up the way Laravel does for rule objects, or null if it isn't a single string. */
    public function enumMessageFor(string $attribute, Enum $rule): ?string
    {
        $rule->setValidator($this);
        $messages = $this->getFromLocalArray($attribute, $rule::class) ?? $rule->message();
        $messages = $messages ? (array) $messages : [$rule::class];

        return array_keys($messages) === [0] && is_string($messages[0])
            ? self::withoutInput($this->makeReplacements($messages[0], $attribute, $rule::class, []))
            : null;
    }

    public function sizeType(string $attribute): string
    {
        return $this->getAttributeType($attribute);
    }

    /** Leaves :input as it is. Laravel fills it in with the value, which only the request has. */
    protected function replaceInputPlaceholder($message, $attribute)
    {
        return $message;
    }

    /** Null for a message that shows the value, so its rule stays on the server. */
    private static function withoutInput(string $message): ?string
    {
        return str_contains($message, ':input') ? null : $message;
    }

    protected function getAttributeType($attribute): string
    {
        return $this->hasRule($attribute, self::FILE_RULES) ? 'file' : parent::getAttributeType($attribute);
    }
}
