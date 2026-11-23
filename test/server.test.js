const test = require("node:test")
const assert = require("node:assert/strict")
const startServer = require("../test-support/server.cjs")

test("the API accepts gray duplicates and reports malformed clue patterns", { timeout: 10000 }, async t => {
    const origin = await startServer(t)
    const search = body => fetch(origin + "/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    })

    const overlap = await search({ pattern: "?????", letters: [..."pas"], ignore: [..."etura"], unknowns: ["s????", "????p"] })
    assert.equal(overlap.status, 200)
    const [total, first] = await overlap.json()
    assert.equal(total, 54)
    assert.ok(first.every(([word]) => word.split("a").length === 2))

    const invalid = await search({ pattern: "?????", unknowns: ["?a??"] })
    assert.equal(invalid.status, 422)
    assert.match((await invalid.json()).error, /same length/)

    const empty = await search({ pattern: "?????", letters: [..."abcdef"] })
    assert.equal(empty.status, 200)
    assert.deepEqual(await empty.json(), [0, [], [], []])
})
