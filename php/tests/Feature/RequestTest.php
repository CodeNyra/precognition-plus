<?php

use CodeNyra\PrecognitionPlus\Tests\Fixtures\UserController;
use Illuminate\Foundation\Http\Middleware\HandlePrecognitiveRequests;
use Illuminate\Support\Facades\Route;

beforeEach(function () {
    UserController::$ran = false;

    Route::middleware(HandlePrecognitiveRequests::class)->group(function () {
        Route::post('/users', [UserController::class, 'store']);
        Route::put('/users/{user}', [UserController::class, 'update']);
        Route::post('/users/{user}/transfer', [UserController::class, 'transfer']);
    });
});

$precognitive = fn (string $only, bool $askForRules = true) => array_filter([
    'Accept' => 'application/json',
    'Precognition' => 'true',
    'Precognition-Validate-Only' => $only,
    'Precognition-Rules' => $askForRules ? 'true' : null,
]);

it('answers a passing first request with the rules, as a 200 instead of the empty 204', function () use ($precognitive) {
    $response = $this->post('/users', ['name' => 'Taylor'], $precognitive('name'))
        ->assertOk()
        ->assertHeader('Precognition', 'true')
        ->assertHeader('Precognition-Success', 'true')
        ->assertJsonPath('rules.email.server', true);

    expect($response->json('rules'))->toHaveKeys(['name', 'email', 'password'])
        ->and($response->getContent())->not->toContain('unique')
        ->and(UserController::$ran)->toBeFalse();
});

it('adds the rules next to validation errors', function () use ($precognitive) {
    $this->post('/users', ['username' => 'taken'], $precognitive('username'))
        ->assertStatus(422)
        ->assertJsonPath('errors.username.0', 'That username is taken.')
        ->assertJsonMissingPath('errors.name')
        ->assertJsonPath('rules.username.server', true);
});

it('builds the rules for the real request', function () use ($precognitive) {
    $this->put('/users/7', ['name' => 'Taylor'], $precognitive('name'))
        ->assertJsonPath('rules.name.rules.1.params', ['17']);
});

it('only sends rules when asked', function () use ($precognitive) {
    $this->put('/users/7', ['name' => 'Taylor'], $precognitive('name', askForRules: false))->assertNoContent();
});

it('never sends rules for a real submit', function () {
    $this->put('/users/7', ['name' => 'Taylor'], ['Precognition-Rules' => 'true'])->assertOk()->assertContent('updated');

    expect(UserController::$ran)->toBeTrue();
});

it('sends nothing to users who may not submit the form', function () use ($precognitive) {
    $this->post('/users/7/transfer', ['title' => 'x'], $precognitive('title'))
        ->assertForbidden()
        ->assertJsonMissingPath('rules');
});

it('sends nothing when disabled', function () use ($precognitive) {
    config(['precognition-plus.enabled' => false]);

    $this->post('/users', ['name' => 'Taylor'], $precognitive('name'))->assertNoContent();
});
