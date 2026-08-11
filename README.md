# @mfe-orchestrator-hub/client-vue

Vue 3 bindings for [`@mfe-orchestrator-hub/client`](https://github.com/mfe-orchestrator/client-core).

Ergonomics only. Every decision — which version is served, how the manifest is fetched, how the
identities are kept — lives in the core. This package is a plugin and two composables.

## Install

```sh
pnpm add @mfe-orchestrator-hub/client-vue
```

`@mfe-orchestrator-hub/client` comes along as a dependency. `vue` is a peer dependency (3.3 or later).

## Usage

```ts
import { createApp } from "vue"
import { createOrchestrator } from "@mfe-orchestrator-hub/client-vue"
import App from "./App.vue"

createApp(App)
    .use(
        createOrchestrator({
            backendUrl: import.meta.env.VITE_MFE_BACKEND_URL,
            projectId: import.meta.env.VITE_MFE_PROJECT_ID,
            environment: import.meta.env.VITE_MFE_ENVIRONMENT
        })
    )
    .mount("#app")
```

The plugin calls `configure()` on install, and `configure()` is idempotent, so installing twice is
harmless.

It stays a convenience. The recommended place is still the very top of the entry point, because a
bundler may import a remote before the app is created:

```ts
import { configure } from "@mfe-orchestrator-hub/client"

configure({ backendUrl: "…", projectId: "…", environment: "…" })
```

### `environment` is optional

Leave it out and the backend picks the environment from the domain the host page is served on:

```ts
createApp(App)
    .use(
        createOrchestrator({
            backendUrl: import.meta.env.VITE_MFE_BACKEND_URL,
            projectId: import.meta.env.VITE_MFE_PROJECT_ID
        })
    )
    .mount("#app")
```

One build then serves every environment, and there is no `VITE_MFE_ENVIRONMENT` to keep in sync with
the domain it is deployed to. The price is that the environment has to be mapped to a domain in the
console: an unmapped domain has no environment to resolve to and the manifest request fails.

Passing `environment` keeps the old behaviour and always wins over the domain. Nothing changes for
an app that already sets it.

This adapter never reads the field. It re-exports the core's `OrchestratorConfig` and hands the
configuration over untouched, so which of the two the backend is asked for is decided entirely in
[the core](https://github.com/mfe-orchestrator/client-core#configuration).

### `useRemoteUrl(slug)`

```vue
<script setup lang="ts">
import { useRemoteUrl } from "@mfe-orchestrator-hub/client-vue"

const { data: url, error, loading } = useRemoteUrl("checkout-new")
</script>

<template>
    <Spinner v-if="loading" />
    <p v-else-if="error">{{ error.message }}</p>
    <p v-else>{{ url }}</p>
</template>
```

`slug` accepts a value, a `ref`, or a getter. When it changes the URL is resolved again, and a late
answer from the previous slug can never overwrite the newer one.

The URL is already pinned to the version the backend resolved. Use it verbatim: never rebuild it and
never strip the `_v/<version>/` segment.

### `useGlobalVariables()`

```ts
const { data: variables } = useGlobalVariables()
// { API_URL: "https://…" }
```

Both composables return the same shape, as refs:

```ts
interface AsyncState<TValue> {
    data: Ref<TValue | undefined>
    error: Ref<Error | undefined>
    loading: Ref<boolean>
}
```

They read the one memoized manifest of the core, so N composables across N components still cost a
single network request.

### With module federation

The composables are for the app's own logic. The remote itself is wired in the bundler config, which
talks to the core directly — see the
[core README](https://github.com/mfe-orchestrator/client-core#bundler-configuration).

## Development

```sh
pnpm install
pnpm build       # tsup, ESM + CJS + types
pnpm typecheck
```

## License

MIT © Lorenzo De Francesco
