<script setup>
import { useForm, usePage } from '@inertiajs/vue3'
import { computed, nextTick, ref, watch } from 'vue'
import { clearLog, fetchingRules, log, logCheck, plusEnabled, removeEntry, serverRequests, togglePlus } from '../demo/requestLog'

const form = useForm('post', '/signup', {
    name: '',
    age: '',
    postcode: '',
    plan: '',
    password: '',
    password_confirmation: '',
    email: '',
    username: '',
    invite: '',
})

const sides = {
    browser: { label: 'browser', class: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', dot: 'bg-emerald-500' },
    both: { label: 'browser + server', class: 'bg-sky-50 text-sky-700 ring-sky-600/20', dot: 'bg-sky-500' },
    server: { label: 'server', class: 'bg-amber-50 text-amber-700 ring-amber-600/20', dot: 'bg-amber-500' },
}

const fields = [
    { name: 'name', label: 'Name', side: 'browser', rules: 'required|string|max:20' },
    { name: 'age', label: 'Age', side: 'browser', rules: 'required|integer|between:18,99', inputmode: 'numeric' },
    { name: 'postcode', label: 'Postcode', side: 'browser', rules: 'required|regex:/^\\d{5}$/', inputmode: 'numeric' },
    { name: 'plan', label: 'Plan', side: 'browser', rules: "required|Rule::in(['free', 'pro', 'team'])", options: ['free', 'pro', 'team'] },
    { name: 'password', label: 'Password', side: 'browser', rules: 'required|string|min:8|confirmed', type: 'password' },
    { name: 'password_confirmation', label: 'Confirm password', side: 'browser', rules: 're-checks password (confirmed)', type: 'password' },
    { name: 'email', label: 'Email', side: 'both', rules: 'required|email|max:255 · then unique:users', hint: 'test@example.com is taken' },
    { name: 'username', label: 'Username', side: 'both', rules: 'required|max:20|regex · then a closure', hint: 'admin, root and taylor are reserved' },
    { name: 'invite', label: 'Invite code', side: 'server', rules: 'nullable|new ValidInviteCode', hint: 'LARAVEL or INERTIA (the server takes 0.4 s)' },
]

let requestsSeen = 0

function check(field) {
    const name = field.name
    const entry = logCheck(field.label)
    const callbacks = {
        onStart: () => (requestsSeen = serverRequests.value),
        onFinish: () => {
            const sent = serverRequests.value > requestsSeen
            const browserChecked = plusEnabled.value && !(sent && fetchingRules.value)

            if (field.side === 'both' && browserChecked) {
                entry.result = sent ? 'browser + server' : 'browser only'
            } else {
                entry.result = !sent ? 'browser' : plusEnabled.value && fetchingRules.value ? 'server · rules loaded' : 'server'
            }
            // Checks the debounce merged into this one never finish on their own, so drop them.
            log.filter((other) => other.type === 'check' && !other.result && other.id < entry.id).forEach(removeEntry)
        },
    }

    if (name === 'password_confirmation') {
        form.validate({ only: ['password'], ...callbacks })
    } else {
        form.validate(name, callbacks)
    }
}

const submit = () => form.submit({ preserveScroll: true, onSuccess: () => form.reset() })

const status = computed(() => usePage().flash.status)
const resultColors = {
    browser: 'text-emerald-400',
    'browser only': 'text-emerald-400',
    'browser + server': 'text-sky-400',
    server: 'text-amber-400',
    'server · rules loaded': 'text-amber-400',
}
const inBrowser = computed(() => log.filter((entry) => entry.result === 'browser' || entry.result === 'browser only').length)

// New rows go at the bottom, so keep the newest in view.
const terminal = ref(null)
watch(
    () => log.length,
    () => nextTick(() => terminal.value?.scrollTo({ top: terminal.value.scrollHeight })),
)
</script>

<template>
    <main class="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <header class="mb-8">
            <div>
                <p class="text-xs text-stone-500">Laravel · Inertia · Vue</p>
                <h1 class="mt-1 text-3xl font-semibold tracking-tight">Precognition Plus</h1>
                <p class="mt-2 text-stone-600">
                    Laravel Precognition that checks simple rules in the browser. Only rules that need the server, like
                    <code class="font-mono text-sm">unique</code> or a custom Rule, send a request.
                </p>
                <p class="mt-2 text-sm text-stone-500">
                    <strong class="font-semibold text-stone-700">NOTE:</strong> The first check always goes to the server, and its answer brings back all the rules. After that, browser rules are checked on the page.
                </p>
            </div>
        </header>

        <div class="mb-4 flex flex-wrap items-center gap-x-5 gap-y-3 text-xs text-stone-600">
            <span v-for="side in sides" :key="side.label" class="inline-flex items-center gap-1.5">
                <span class="size-2 rounded-full" :class="side.dot"></span>{{ side.label }}
            </span>
            <button type="button" role="switch" :aria-checked="plusEnabled" class="ml-auto inline-flex items-center gap-2" @click="togglePlus">
                <span class="relative h-5 w-9 rounded-full transition-colors" :class="plusEnabled ? 'bg-emerald-500' : 'bg-stone-300'">
                    <span class="absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform" :class="{ 'translate-x-4': plusEnabled }"></span>
                </span>
                Precognition Plus {{ plusEnabled ? 'on' : 'off' }}
            </button>
        </div>

        <p v-if="status" class="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{{ status }}</p>

        <div class="grid gap-6 lg:grid-cols-[1fr_24rem]">
            <form class="overflow-hidden rounded-lg border border-stone-200 bg-white" @submit.prevent="submit">
                <div class="flex items-center justify-between border-b border-stone-200 bg-stone-50 px-5 py-2 font-mono text-xs text-stone-500">
                    <span><span class="font-semibold text-stone-800">POST</span> /signup</span>
                    <span>SignupRequest</span>
                </div>

                <div class="divide-y divide-stone-100">
                    <div v-for="field in fields" :key="field.name" class="px-5 py-4">
                        <div class="mb-1.5 flex items-center justify-between gap-2">
                            <label :for="field.name" class="text-sm font-medium">{{ field.label }}</label>
                            <span class="rounded px-1.5 py-0.5 text-[11px] ring-1 ring-inset" :class="sides[field.side].class">{{ sides[field.side].label }}</span>
                        </div>

                        <select
                            v-if="field.options"
                            :id="field.name"
                            v-model="form[field.name]"
                            class="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
                            @change="check(field)"
                        >
                            <option value="">Choose…</option>
                            <option v-for="option in field.options" :key="option" :value="option">{{ option }}</option>
                            <option value="enterprise">enterprise (not allowed)</option>
                        </select>
                        <input
                            v-else
                            :id="field.name"
                            v-model="form[field.name]"
                            :type="field.type ?? 'text'"
                            :inputmode="field.inputmode"
                            autocomplete="off"
                            class="w-full rounded-md border px-3 py-2 text-sm focus:outline-none"
                            :class="form.invalid(field.name) ? 'border-red-400' : form.valid(field.name) ? 'border-emerald-400' : 'border-stone-300 focus:border-stone-500'"
                            @change="check(field)"
                        />

                        <code class="mt-1.5 block font-mono text-xs text-stone-500">{{ field.rules }}</code>
                        <p v-if="form.invalid(field.name)" class="mt-1 text-sm text-red-600">{{ form.errors[field.name] }}</p>
                        <p v-else-if="field.hint" class="mt-1 font-mono text-xs text-stone-400">// {{ field.hint }}</p>
                    </div>
                </div>

                <div class="flex flex-wrap items-center gap-3 border-t border-stone-200 bg-stone-50 px-5 py-3">
                    <button type="submit" class="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" :disabled="form.processing">
                        Sign up
                    </button>
                    <span v-if="form.validating" class="text-sm text-stone-500">Checking on the server…</span>
                    <span class="ml-auto text-xs text-stone-500">submit → server, every rule</span>
                </div>
            </form>

            <aside class="overflow-hidden rounded-lg bg-stone-900 font-mono text-sm text-stone-300 lg:sticky lg:top-6 lg:self-start">
                <div class="flex items-center justify-between border-b border-stone-700 px-4 py-2 text-xs">
                    <div class="flex items-center gap-1.5">
                        <span class="size-2.5 rounded-full bg-stone-600"></span>
                        <span class="size-2.5 rounded-full bg-stone-600"></span>
                        <span class="size-2.5 rounded-full bg-stone-600"></span>
                        <span class="ml-2 text-stone-400">checks</span>
                    </div>
                    <button v-if="log.length" type="button" class="text-stone-400 hover:text-stone-100" @click="clearLog">clear</button>
                </div>

                <div ref="terminal" class="h-96 overflow-y-auto px-4 py-3 leading-6">
                    <div v-for="entry in log" :key="entry.id" class="flex justify-between gap-2">
                        <template v-if="entry.type === 'check'">
                            <span><span class="text-stone-500">›</span> {{ entry.label }}</span>
                            <span v-if="entry.result" :class="resultColors[entry.result]">{{ entry.result }}</span>
                            <span v-else class="animate-pulse text-stone-500">checking…</span>
                        </template>
                        <span v-else class="text-stone-500"># {{ entry.text }}</span>
                    </div>
                    <div>
                        <span class="text-stone-500">›</span>
                        <span v-if="!log.length" class="text-stone-500"> Fill inputs and switch focus to test</span>
                        <span class="ml-1 animate-pulse">▍</span>
                    </div>
                </div>

                <div class="border-t border-stone-700 px-4 py-2 text-xs text-stone-400">
                    <span class="font-semibold text-emerald-400">{{ inBrowser }}</span> in the browser ·
                    <span class="font-semibold text-amber-400">{{ serverRequests }}</span> sent to the server
                </div>
            </aside>
        </div>
    </main>
</template>
