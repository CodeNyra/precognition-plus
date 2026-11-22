<?php

namespace CodeNyra\PrecognitionPlus\Schema;

use Closure;
use Illuminate\Contracts\Translation\Translator;
use Illuminate\Support\Str;
use Illuminate\Validation\Factory;
use Illuminate\Validation\Rules\Enum;
use Illuminate\Validation\Validator;

/** @internal */
final class MessageResolver extends Validator
{
    private const FILE_RULES = ['File', 'Image', 'Mimes', 'Mimetypes', 'Extensions'];

    /** @var list<string> The app's extensions from Validator::extendDependent(), which read other fields. */
    private array $dependentExtensionNames = [];

    public function __construct(Translator $translator, array $messages = [], array $attributes = [], ?Factory $factory = null)
    {
        parent::__construct($translator, [], [], $messages, $attributes);

        if ($factory !== null) {
            $this->extendLike($factory);
        }
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

        return $this->objectMessageFor($attribute, $rule, $rule->message());
    }

    /**
     * A rule object's message, looked up the way validateUsingCustomRule() does, with messages() by
     * the rule's class ahead of the rule's own. Null if it isn't a single string.
     *
     * @param  string|array<mixed>|null  $message  What the rule's message() gives.
     */
    public function objectMessageFor(string $attribute, object $rule, mixed $message): ?string
    {
        $messages = $this->getFromLocalArray($attribute, $rule::class) ?? $message;
        $messages = $messages ? (array) $messages : [$rule::class];

        return array_keys($messages) === [0] && is_string($messages[0])
            ? self::withoutInput($this->makeReplacements($messages[0], $attribute, $rule::class, []))
            : null;
    }

    /** Whether Laravel runs the rule on empty fields, like required_with or an implicit extension. */
    public function runsOnEmpty(string $rule): bool
    {
        return $this->isImplicit($rule);
    }

    /** Whether the rule comes from Validator::extendDependent(), so it reads fields the browser can't name. */
    public function readsOtherFields(string $rule): bool
    {
        return in_array($rule, $this->dependentExtensionNames, true);
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

    /** Takes the app's extensions, replacers and fallback messages from the factory, as Factory::resolve() does. */
    private function extendLike(Factory $factory): void
    {
        [$implicit, $dependent, $replacers, $fallback, $container] = Closure::bind(
            fn () => [$this->implicitExtensions, $this->dependentExtensions, $this->replacers, $this->fallbackMessages, $this->container],
            $factory,
            Factory::class,
        )();

        $this->addImplicitExtensions($implicit);
        $this->addDependentExtensions($dependent);
        $this->addReplacers($replacers);
        $this->setFallbackMessages($fallback);
        $this->dependentExtensionNames = array_map(Str::studly(...), array_keys($dependent));

        if ($container !== null) {
            $this->setContainer($container);
        }
    }
}
