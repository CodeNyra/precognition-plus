<?php

namespace CodeNyra\PrecognitionPlus\Tests\Fixtures;

class UserController
{
    public static bool $ran = false;

    public function store(StoreUserRequest $request): string
    {
        static::$ran = true;

        return 'stored';
    }

    public function update(UpdateUserRequest $request, string $user): string
    {
        static::$ran = true;

        return 'updated';
    }

    public function transfer(ForbiddenRequest $request, string $user): string
    {
        return 'transferred';
    }
}
