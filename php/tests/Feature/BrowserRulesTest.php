<?php

use CodeNyra\PrecognitionPlus\BrowserRule;
use CodeNyra\PrecognitionPlus\BrowserRules;
use Illuminate\Support\Str;

it('lists the same rules as the browser', function () {
    $source = file_get_contents(__DIR__.'/../../../js/src/browser_rules.ts');
    preg_match('/export const browserRules[^{]*\{(.*?)\n\}/s', $source, $list);
    preg_match_all('/^  (\w+)[:,]/m', $list[1], $names);
    $php = array_keys((new ReflectionClassConstant(BrowserRules::class, 'RULES'))->getValue());

    expect($names[1])->toEqualCanonicalizing(array_map(Str::snake(...), $php));

    foreach ($names[1] as $name) {
        expect(BrowserRules::named(Str::studly($name)))->toBeInstanceOf(BrowserRule::class);
    }
});
