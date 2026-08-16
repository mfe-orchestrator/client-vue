import type { App } from "vue"
import { afterEach, describe, expect, it, vi } from "vitest"

const baseConfig = { backendUrl: "https://console.test/api", projectId: "p1" }

/**
 * A stand in for the core package. `setUserId` can be dropped from it, which is what a host still on
 * a core that predates the call actually has.
 */
const createCore = (overrides: Record<string, unknown> = {}) => ({
    configure: vi.fn(),
    registerIntegration: vi.fn(),
    remoteUrl: vi.fn(async () => "https://console.test/serve/mfe/files/auto/p1/checkout/_v/1.0.0/assets/remoteEntry.js"),
    globalVariables: vi.fn(async () => ({})),
    setUserId: vi.fn(),
    ...overrides
})

/** A fresh module registry per test, so the mocked core is the one the adapter imports. */
const loadAdapter = async (core: ReturnType<typeof createCore> | Record<string, unknown>) => {
    vi.resetModules()
    vi.doMock("@mfe-orchestrator-hub/client", () => core)
    return await import("../src/index")
}

/** The plugin only ever receives the app to install itself on, and this one never uses it. */
const fakeApp = {} as App

describe("@mfe-orchestrator-hub/client-vue", () => {
    afterEach(() => {
        vi.doUnmock("@mfe-orchestrator-hub/client")
    })

    describe("createOrchestrator", () => {
        it("given the plugin, when the app installs it, then the configuration is handed to the core and the integration is declared", async () => {
            const core = createCore()
            const { createOrchestrator } = await loadAdapter(core)

            createOrchestrator({ ...baseConfig, userId: "user-1" }).install?.(fakeApp)

            expect(core.configure).toHaveBeenCalledExactlyOnceWith({ ...baseConfig, userId: "user-1" })
            expect(core.registerIntegration).toHaveBeenCalledWith("vue")
            expect(core.setUserId).not.toHaveBeenCalled()
        })
    })

    describe("setUserId", () => {
        it("given a core that exposes it, when the user is set, then the call is forwarded untouched", async () => {
            const core = createCore()
            const { setUserId } = await loadAdapter(core)

            setUserId("user-9")

            expect(core.setUserId).toHaveBeenCalledExactlyOnceWith("user-9")
        })

        it("given a user that logs out, when undefined is set, then undefined reaches the core rather than nothing at all", async () => {
            const core = createCore()
            const { setUserId } = await loadAdapter(core)

            setUserId(undefined)

            expect(core.setUserId).toHaveBeenCalledExactlyOnceWith(undefined)
        })

        it("given a getter, when the user is set, then it travels as it is, for the core to resolve at request time", async () => {
            const core = createCore()
            const { setUserId } = await loadAdapter(core)
            const currentUserId = async () => "late-user"

            setUserId(currentUserId)

            expect(core.setUserId).toHaveBeenCalledExactlyOnceWith(currentUserId)
        })

        it("given a core that predates the call, when the user is set, then it does not throw and warns naming the package to upgrade", async () => {
            const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
            const { setUserId } = await loadAdapter(createCore({ setUserId: undefined }))

            setUserId("user-9")

            expect(warn).toHaveBeenCalledTimes(1)
            expect(String(warn.mock.calls[0][0])).toContain("@mfe-orchestrator-hub/client")
            warn.mockRestore()
        })
    })
})
