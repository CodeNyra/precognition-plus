<?php

namespace CodeNyra\PrecognitionPlus\Tests\Fixtures;

use CodeNyra\PrecognitionPlus\ServerOnly;

#[ServerOnly('coupon')]
class PrivateCouponRequest extends CheckoutRequest {}
