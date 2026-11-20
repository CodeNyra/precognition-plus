<?php

namespace CodeNyra\PrecognitionPlus\Schema;

use Illuminate\Contracts\Translation\Translator;
use Illuminate\Validation\Validator;

/** @internal */
final class MessageResolver extends Validator
{
    private const FILE_RULES = ['File', 'Image', 'Mimes', 'Mimetypes', 'Extensions'];

    public function __construct(Translator $translator, array $messages = [], array $attributes = [])
    {
        parent::__construct($translator, [], [], $messages, $attributes);
    }

    /** @param  list<string>  $rules */
    public function useRules(string $attribute, array $rules): void
    {
        $this->rules = [$attribute => $rules];
    }

    /** @param  list<string>  $parameters */
    public function messageFor(string $attribute, string $rule, array $parameters): string
    {
        return $this->makeReplacements($this->getMessage($attribute, $rule), $attribute, $rule, $parameters);
    }

    public function sizeType(string $attribute): string
    {
        return $this->getAttributeType($attribute);
    }

    /** @return array<string, string> The names `validation.values.<attribute>` gives to values, used for :input. */
    public function valueNames(string $attribute): array
    {
        $names = $this->translator->get("validation.values.{$attribute}");

        return is_array($names) ? $names : [];
    }

    /** The value isn't known yet. The browser fills :input in when it shows the message. */
    protected function replaceInputPlaceholder($message, $attribute)
    {
        return $message;
    }

    protected function getAttributeType($attribute): string
    {
        return $this->hasRule($attribute, self::FILE_RULES) ? 'file' : parent::getAttributeType($attribute);
    }
}
