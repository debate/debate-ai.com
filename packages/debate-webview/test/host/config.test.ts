import { afterEach, describe, expect, it } from "vitest"
import { getHostConnectQwkSearch } from "@debate-ai/qwksearch/components/host-connect"

import { configureHost } from "../../src/host/config"

afterEach(() => configureHost({}))

describe("configureHost", () => {
  it("hands the host's QwkSearch connect flow to the qwksearch package", async () => {
    const connect = async () => ({ ok: true })
    configureHost({ connectQwkSearch: connect })
    expect(getHostConnectQwkSearch()).toBe(connect)
  })

  it("clears it again when the next config has none", () => {
    configureHost({ connectQwkSearch: async () => ({ ok: true }) })
    configureHost({})
    expect(getHostConnectQwkSearch()).toBeUndefined()
  })
})
