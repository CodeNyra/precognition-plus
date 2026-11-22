<?php

namespace CodeNyra\PrecognitionPlus;

use CodeNyra\PrecognitionPlus\Dispatchers\CallableDispatcher;
use CodeNyra\PrecognitionPlus\Dispatchers\ControllerDispatcher;
use Illuminate\Foundation\Http\Events\RequestHandled;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Routing\Contracts\CallableDispatcher as CallableDispatcherContract;
use Illuminate\Routing\Contracts\ControllerDispatcher as ControllerDispatcherContract;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;

class PrecognitionPlusServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__.'/../config/precognition-plus.php', 'precognition-plus');

        // Precognition validates the form when Laravel calls the controller or route closure, inside
        // the request's middleware, so the rules are built there too, while the request's state holds.
        $this->app->extend(ControllerDispatcherContract::class, fn (ControllerDispatcherContract $dispatcher) => new ControllerDispatcher($dispatcher));
        $this->app->extend(CallableDispatcherContract::class, fn (CallableDispatcherContract $dispatcher) => new CallableDispatcher($dispatcher));
    }

    public function boot(): void
    {
        $this->publishes([
            __DIR__.'/../config/precognition-plus.php' => config_path('precognition-plus.php'),
        ], 'precognition-plus-config');

        $this->app->resolving(FormRequest::class, fn (FormRequest $form, $app) => PrecognitionPlus::capture($form, $app['request']));

        Event::listen(RequestHandled::class, fn (RequestHandled $event) => PrecognitionPlus::attach($event->request, $event->response));
    }
}
