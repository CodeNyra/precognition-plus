<?php

use Illuminate\Support\Str;

// The browser trims the same characters as TrimStrings (js/src/core/utils.ts). This test fails when
// the installed Laravel trims anything else, so the browser can be updated to match.
it('trims exactly the characters the browser trims', function () {
    $expected = [
        0x00, ...range(0x09, 0x0D), 0x20, 0x85, 0xA0, 0xAD, 0x034F, 0x061C, 0x115F, 0x1160, 0x1680, 0x17B4,
        0x17B5, 0x180E, ...range(0x2000, 0x200F), 0x2028, 0x2029, 0x202F, ...range(0x205F, 0x2065),
        ...range(0x206A, 0x206F), 0x2800, 0x3000, 0x3164, 0xFEFF, 0xFFA0, 0x1D159, ...range(0x1D173, 0x1D17A), 0xE0020,
    ];

    // The planes with spaces and invisible characters, which are the basic and supplementary
    // multilingual planes and the tags block of plane 14.
    $trimmed = [];

    foreach ([[0x0000, 0x1FFFF], [0xE0000, 0xE0FFF]] as [$from, $to]) {
        for ($code = $from; $code <= $to; $code++) {
            if (($code < 0xD800 || $code > 0xDFFF) && Str::trim('x'.mb_chr($code, 'UTF-8')) === 'x') {
                $trimmed[] = $code;
            }
        }
    }

    expect($trimmed)->toBe($expected);
});
