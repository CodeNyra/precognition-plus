<?php

namespace CodeNyra\PrecognitionPlus\Tests;

use CodeNyra\PrecognitionPlus\PrecognitionPlusServiceProvider;
use Orchestra\Testbench\TestCase as Orchestra;

abstract class TestCase extends Orchestra
{
    protected function getPackageProviders($app): array
    {
        return [PrecognitionPlusServiceProvider::class];
    }

    protected function defineEnvironment($app): void
    {
        $app['config']->set('app.key', 'base64:'.base64_encode(str_repeat('a', 32)));
    }
}
