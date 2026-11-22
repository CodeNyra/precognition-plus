<?php

namespace CodeNyra\PrecognitionPlus\Tests\Fixtures;

enum Suffix: string
{
    case Slash = 'end\\';
    case Quote = 'say "hi"';
    case Plain = 'plain';
}
