<?php

namespace CodeNyra\PrecognitionPlus\Tests\Fixtures;

use Closure;
use Illuminate\Http\Request;

/** Sets the locale for the request and puts the old one back afterwards, as Octane-safe middleware does. */
class SetsLocaleBriefly
{
    public function handle(Request $request, Closure $next): mixed
    {
        $previous = app()->getLocale();
        app()->setLocale('de');

        try {
            return $next($request);
        } finally {
            app()->setLocale($previous);
        }
    }
}
