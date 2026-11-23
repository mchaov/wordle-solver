const test = require("node:test")
const assert = require("node:assert/strict")
const { spawn } = require("node:child_process")
const { once } = require("node:events")
const path = require("node:path")
const { createInterface } = require("node:readline")

test("the API accepts gray duplicates and reports malformed clue patterns", { timeout: 10000 }, async t => {
    const child = spawn(process.execPath, [path.join(__dirname, "../server.js")], {
        env: { ...process.env, PORT: "0" },
        stdio: ["ignore", "pipe", "inherit"],
        windowsHide: true
    })
    const exited = once(child, "exit")
    t.after(async () => {
        if (child.exitCode === null) child.kill()
        await exited
    })
    const output = createInterface({ input: child.stdout })
    const [line] = await Promise.race([
        once(output, "line"),
        exited.then(([code]) => { throw new Error("Server exited during startup with code " + code) })
    ])
    const [, port] = line.match(/^Server listening at port (\d+)$/)
    const search = body => fetch("http://127.0.0.1:" + port + "/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    })

    const overlap = await search({ pattern: "?????", letters: [..."pas"], ignore: [..."etura"], unknowns: ["s????", "????p"] })
    assert.equal(overlap.status, 200)
    const [total, first] = await overlap.json()
    assert.equal(total, 96)
    assert.ok(first.every(([word]) => word.split("a").length === 2))

    const invalid = await search({ pattern: "?????", unknowns: ["?a??"] })
    assert.equal(invalid.status, 422)
    assert.match((await invalid.json()).error, /same length/)

    const empty = await search({ pattern: "?????", letters: [..."abcdef"] })
    assert.equal(empty.status, 200)
    assert.deepEqual(await empty.json(), [0, [], [], []])
})
