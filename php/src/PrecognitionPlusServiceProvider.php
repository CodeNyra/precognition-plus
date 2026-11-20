<?php

namespace CodeNyra\PrecognitionPlus;

use Illuminate\Foundation\Http\Events\RequestHandled;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;

class PrecognitionPlusServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__.'/../config/precognition-plus.php', 'precognition-plus');
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
