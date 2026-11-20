<?php

use App\Http\Requests\SignupRequest;
use App\Models\User;
use Illuminate\Foundation\Http\Middleware\HandlePrecognitiveRequests;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::inertia('/', 'Signup');

Route::post('/signup', function (SignupRequest $request) {
    $user = User::create($request->safe()->only(['name', 'email', 'password']));

    Inertia::flash('status', "Signed up {$user->email}. Its email now counts as taken.");

    return back();
})->middleware(HandlePrecognitiveRequests::class);
