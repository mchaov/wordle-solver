const test = require("node:test")
const assert = require("node:assert/strict")
const { readFileSync } = require("node:fs")
const path = require("node:path")
const { spawnSync } = require("node:child_process")
const solve = require("../solver")

test("English five-letter searches include the case-insensitive text dictionary and the existing candidates", () => {
    const text = readFileSync(path.join(__dirname, "../words/en.words.txt"), "utf8")
    const expected = new Set(require("../words/words/english5.json"))
    for (const line of text.split(/\r?\n/)) {
        if (/^[a-z]{5}$/i.test(line)) expected.add(line.toLowerCase())
    }
    assert.equal(solve("en", "?????")[0], expected.size)
    for (const word of ["swoon", "llama", "aamsi", "linux"]) {
        const [total, first] = solve("en", word.toUpperCase())
        assert.equal(total, 1, word)
        assert.equal(first[0][0], word)
    }
    assert.equal(solve("en", "sw?on")[1][0][0], "swoon")
})

test("the reported sets of valid clues show their answers in all three rankings", () => {
    const cases = [
        { pattern: "?????", known: "lord", invalid: "ceasw", count: 9, answers: ["drool", "droll"] },
        { pattern: "????t", known: "tle", invalid: "carsoinf", count: 14, answers: ["veldt"] },
        { pattern: "?over", known: "reov", invalid: "atsdinpwc", impossible: ["r????"], count: 3, answers: ["hover", "lover", "mover"] }
    ]
    for (const { pattern, known, invalid, impossible, count, answers } of cases) {
        const [total, ...rankings] = solve("en", pattern, [...known], [...invalid], impossible)
        assert.equal(total, count)
        for (const ranking of rankings) {
            const candidates = ranking.map(row => row[0])
            for (const answer of answers) assert.ok(candidates.includes(answer), answer)
        }
    }
})

test("a known and gray A means exactly one A alongside the other clues", () => {
    const [total, ...rankings] = solve("en", "?????", [..."pas"], [..."etura"], ["s????", "????p"])
    assert.equal(total, 96)
    for (const ranking of rankings) {
        for (const [word] of ranking) {
            assert.equal(word.indexOf("a"), word.lastIndexOf("a"))
            assert.ok([..."pas"].every(letter => word.includes(letter)))
            assert.doesNotMatch(word, /[etur]|^s|p$/)
        }
    }
    const withoutGrayA = solve("en", "p?sh?", [..."pas"], [..."etur"])[1]
    const withGrayA = solve("en", "p?sh?", [..."pas"], [..."etura"])[1]
    assert.ok(withoutGrayA.some(([word]) => word === "pasha"))
    assert.ok(withGrayA.every(([word]) => word !== "pasha"))
})

test("green positions and Known letters can describe the same confirmed copies", () => {
    const [total, first] = solve("en", "s?e?l", [..."sel"], [..."carte"])
    assert.equal(total, 10)
    assert.ok(first.some(([word]) => word === "shell"))
    assert.ok(first.every(([word]) => word.indexOf("e") === word.lastIndexOf("e")))

    // Two fixed As cap the count at two even when Known letters mentions only one.
    assert.equal(solve("en", "llama", ["a"], ["a"])[0], 1)
    // One fixed A is already included in the two confirmed As.
    assert.equal(solve("en", "llam?", ["a", "a"], ["A", "a"])[1][0][0], "llama")
    assert.equal(solve("en", "llam?", ["a"], ["a"])[0], 0)
    assert.equal(solve("en", "s?e?l", [], [..."cartE"])[0], total)
})

test("repeated known letters set a minimum and a gray tile makes it exact", () => {
    // 'eerie' contains three Es. The pattern confirms one of them.
    assert.ok(solve("en", "??rie", ["e", "e"])[1].some(([word]) => word === "eerie"))
    assert.ok(solve("en", "??rie", ["e", "e"], ["e"])[1].every(([word]) => word !== "eerie"))
    assert.equal(solve("bg", "к?рт?", ["А", "а"], ["а"])[1][0][0], "карта")
    assert.equal(solve("bg", "к?рт?", ["А"], ["а"])[0], 0)
})

test("letter case does not change scores or position exclusions", () => {
    assert.deepEqual(
        solve("en", "C????", ["A", "R"], ["T", "I"], ["?A???"]),
        solve("en", "c????", ["a", "r"], ["t", "i"], ["?a???"])
    )
    assert.equal(solve("bg", "ОКЕАН")[1][0][0], "океан")
    assert.equal(solve("en", "search")[1][0][0], "search")
})

test("the CLI treats a word containing 'not' as a search pattern", () => {
    const result = spawnSync(process.execPath, [path.join(__dirname, "../index.js"), "en", "noted"], { encoding: "utf8" })
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /Total results: 1\b/)
    assert.match(result.stdout, /'noted'/)
})
