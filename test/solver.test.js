const test = require("node:test")
const assert = require("node:assert/strict")
const { createHash } = require("node:crypto")
const path = require("node:path")
const { spawnSync } = require("node:child_process")
const solve = require("../solver")

test("both English pools match the verified American dictionary export", () => {
    const lists = [
        [5, require("../words/words/english5.json"), "cffa4798e2252485be02fec40b2e8d6633d38fdfb0b3354562d72503e0ea46f3"],
        [6, require("../words/words/english6.json"), "c60432683bf9e07dbcf7cf924a68a0aa4382915ec831ee24cf1bca9f25f873b9"]
    ]
    for (const [length, words, expectedDigest] of lists) {
        const digest = createHash("sha256").update(words.join("\n") + "\n").digest("hex")
        assert.equal(digest, expectedDigest)
        assert.ok(words.every(word => word.length === length && /^[a-z]+$/.test(word)))
        assert.deepEqual(words, [...new Set(words)].sort())
        assert.equal(solve("en", "?".repeat(length))[0], words.length)
    }
})

test("English searches recognize game words, US spellings, inflections and lowercase senses", () => {
    for (const word of ["swoon", "llama", "veldt", "hover", "qubit", "bento", "emoji", "abled",
        "fiber", "color", "center", "honor", "robin", "polish", "radar", "abacus", "quasar", "muffin", "fjords", "emojis"]) {
        const [total, first] = solve("en", word.toUpperCase())
        assert.equal(total, 1, word)
        assert.equal(first[0][0], word)
    }
    for (const word of ["aamsi", "linux", "alice", "aires", "aieee", "paris", "debian", "flickr",
        "approx", "doesnt", "colour", "centre", "fibre", "honour", "zzzzz", "zzzzzz"]) {
        assert.deepEqual(solve("en", word), [0, [], [], []], word)
    }
    assert.equal(solve("en", "sw?on")[1][0][0], "swoon")
})

test("the reported sets of valid clues show their answers in all three rankings", () => {
    const cases = [
        { pattern: "?????", known: "lord", invalid: "ceasw", count: 4, answers: ["drool", "droll"] },
        { pattern: "????t", known: "tle", invalid: "carsoinf", count: 5, answers: ["veldt"] },
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
    assert.equal(total, 54)
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
    assert.equal(total, 8)
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
