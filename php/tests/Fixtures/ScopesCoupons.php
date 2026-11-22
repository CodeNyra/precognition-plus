<?php

namespace CodeNyra\PrecognitionPlus\Tests\Fixtures;

use Closure;
use Illuminate\Http\Request;

/** Scopes the request to one tenant and puts the scope back afterwards, as Octane-safe middleware does. */
class ScopesCoupons
{
    /** The coupons a form may take, every tenant's while no tenant is set. */
    public static array $coupons = ['ACME-10', 'GLOBEX-VIP'];

    public function handle(Request $request, Closure $next): mixed
    {
        $previous = static::$coupons;
        static::$coupons = ['ACME-10'];

        try {
            return $next($request);
        } finally {
            static::$coupons = $previous;
        }
    }
}
