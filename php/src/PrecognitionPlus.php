<?php

namespace CodeNyra\PrecognitionPlus;

use Closure;
use CodeNyra\PrecognitionPlus\Schema\SchemaBuilder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class PrecognitionPlus
{
    public const HEADER = 'Precognition-Rules';

    public static function capture(FormRequest $form, Request $request): void
    {
        if ($request->headers->has(static::HEADER) && ! $request->attributes->has(static::HEADER)) {
            $request->attributes->set(static::HEADER, $form);
        }
    }

    public static function attach(Request $request, Response $response): void
    {
        $form = $request->attributes->get(static::HEADER);
        $status = $response->getStatusCode();

        if (! $form instanceof FormRequest
            || ! config('precognition-plus.enabled')
            || ! $request->isPrecognitive()
            || ! in_array($status, [204, 422], true)
            || ($schema = static::schema($form)) === null) {
            return;
        }

        $body = $status === 204 ? [] : json_decode((string) $response->getContent(), true);
        $json = is_array($body) ? json_encode([...$body, 'rules' => $schema]) : false;

        if ($json === false) {
            return;
        }

        if ($status === 204) {
            $response->setStatusCode(200);
        }

        $response->headers->set('Content-Type', 'application/json');
        $response->setContent($json);
    }

    /** @return array<string, array<string, mixed>>|null */
    public static function schema(FormRequest $form): ?array
    {
        try {
            [$rules, $messages, $attributes] = Closure::bind(
                fn () => [$this->validationRules(), $this->messages(), $this->attributes()],
                $form,
                FormRequest::class,
            )();

            return (new SchemaBuilder(app('translator')))->build($rules, $messages, $attributes);
        } catch (Throwable $e) {
            report($e);

            return null;
        }
    }
}
