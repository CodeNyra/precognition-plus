<?php

namespace CodeNyra\PrecognitionPlus\Dispatchers;

use CodeNyra\PrecognitionPlus\PrecognitionPlus;
use Illuminate\Routing\Contracts\CallableDispatcher as Dispatcher;
use Illuminate\Routing\Route;

/**
 * Builds the rules for route closures, the way ControllerDispatcher does for controllers.
 *
 * @internal
 */
final class CallableDispatcher implements Dispatcher
{
    public function __construct(private readonly Dispatcher $dispatcher) {}

    public function dispatch(Route $route, $callable)
    {
        try {
            return $this->dispatcher->dispatch($route, $callable);
        } finally {
            PrecognitionPlus::build(app('request'));
        }
    }
}
