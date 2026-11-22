<?php

namespace CodeNyra\PrecognitionPlus\Tests\Fixtures;

use CodeNyra\PrecognitionPlus\ServerOnly;

/** Used by the forms that take a coupon, the way a trait of shared rules would be. */
#[ServerOnly('coupon')]
trait KeepsCouponPrivate {}
