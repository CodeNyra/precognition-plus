<?php

namespace CodeNyra\PrecognitionPlus\Dispatchers;

use CodeNyra\PrecognitionPlus\PrecognitionPlus;
use Illuminate\Routing\Contracts\ControllerDispatcher as Dispatcher;
use Illuminate\Routing\Route;

/**
 * Builds the rules right where Precognition validates the form, while the request's middleware is still running.
 *
 * @internal
 */
final class ControllerDispatcher implements Dispatcher
{
    public function __construct(private readonly Dispatcher $dispatcher) {}

    public function dispatch(Route $route, $controller, $method)
    {
        try {
            return $this->dispatcher->dispatch($route, $controller, $method);
        } finally {
            PrecognitionPlus::build(app('request'));
        }
    }

    public function getMiddleware($controller, $method)
    {
        return $this->dispatcher->getMiddleware($controller, $method);
    }
}
