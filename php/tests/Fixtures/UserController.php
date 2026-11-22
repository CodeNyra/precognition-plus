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

    public function join(ClosedRequest $request): string
    {
        return 'joined';
    }

    public function redeem(UnpreparedRequest $request): string
    {
        return 'redeemed';
    }

    public function label(UnencodableRequest $request): string
    {
        return 'labelled';
    }

    public function shape(ShapedErrorsRequest $request): string
    {
        return 'shaped';
    }

    public function page(PageErrorsRequest $request): string
    {
        return 'paged';
    }

    public function localize(LocalizedRequest $request): string
    {
        return 'localized';
    }

    public function coupon(CouponRequest $request): string
    {
        return 'redeemed';
    }
}
