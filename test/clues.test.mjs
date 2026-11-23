import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { compileClues, ClueError, draftSelections, marksForSuggestion } from "../static/clues.mjs"
import solve from "../solver.js"

const row = (word, colors) => ({
    word, marks: [...colors].map(color => ({ g: "correct", y: "elsewhere", ".": "absent" })[color])
})
const compile = (rows, manual = {}) => compileClues({ lang: "en", length: 5, rows, manual })

test("the complete board produces the existing parse payload and the three OVER words", () => {
    const body = compile([row("acrid", "..y.."), row("rover", ".gggg")])
    assert.deepEqual(body, {
        lang: "en", pattern: "?over", letters: [..."over"], ignore: [..."acidr"], unknowns: ["??r??", "r????"]
    })
    const [total, first] = solve(body.lang, body.pattern, body.letters, body.ignore, body.unknowns)
    assert.equal(total, 3)
    assert.deepEqual(first.map(([word]) => word), ["hover", "lover", "mover"])
})

test("suggestions carry confirmed positions first and use each remaining confirmed copy once", () => {
    const over = compile([row("acrid", "..y.."), row("rover", ".gggg")])
    assert.deepEqual(marksForSuggestion("hover", over), row("hover", ".gggg").marks)
    const repeatedClue = compile([row("acrid", "..y.."), row("thorn", "...y.")])
    assert.deepEqual(marksForSuggestion("refer", repeatedClue), row("refer", "y....").marks)
    const twoAs = compile([], { pattern: "????a", knownLetters: "aa" })
    assert.deepEqual(marksForSuggestion("arara", twoAs), row("arara", "y...g").marks)
    const bulgarian = compileClues({ lang: "bg", length: 6, rows: [], manual: { pattern: "С????А", knownLetters: "АА" } })
    assert.deepEqual(marksForSuggestion("страна", bulgarian), row("страна", "g..y.g").marks)
})

test("a replacement suggestion carries draft selections by letter and position", () => {
    const draft = row("eerie", ".y..g")
    const empty = compile([])
    const selections = draftSelections(draft)
    assert.deepEqual(marksForSuggestion("eerie", empty, selections), draft.marks)
    assert.deepEqual(marksForSuggestion("arete", empty, selections), row("arete", "..y.g").marks)
    assert.deepEqual(marksForSuggestion("arise", empty, draftSelections(row("rai", "gyg"))), row("arise", "yyg..").marks)
    assert.deepEqual(marksForSuggestion("raise", empty), row("raise", ".....").marks)
    assert.deepEqual(draft, row("eerie", ".y..g"))
})

test("repeat sightings count once, distinct green positions and same-row copies count separately", () => {
    const once = compile([row("array", "y...."), row("tales", ".g..."), row("tales", ".g...")])
    assert.deepEqual(once.letters, ["a"])
    assert.deepEqual(once.ignore, [..."raytles"])
    assert.deepEqual(once.unknowns, ["a????", "???a?"])
    const twoGreens = [row("abcde", "g...."), row("fghia", "....g")]
    assert.deepEqual(compile(twoGreens).letters, ["a", "a"])
    assert.throws(() => compile([...twoGreens, row("aapqr", "g....")]), error =>
        error instanceof ClueError && /A is limited to 1/.test(error.message) && new Set(error.sources).size === 3)
    assert.deepEqual(compile([row("papal", ".y.y.")]).letters, ["a", "a"])
})

test("all gray, count conflicts, incompatible fixed positions and blocked slots", () => {
    assert.deepEqual(compile([row("swoon", ".....")]), {
        lang: "en", pattern: "?????", letters: [], ignore: [..."swon"], unknowns: []
    })
    assert.throws(() => compile([row("swoon", "....."), row("bells", "....g")]), /Guess 1.*Guess 2.*S is limited to 0/)
    assert.throws(() => compile([row("swoon", "g...."), row("bells", "g....")]), /Guess 1.*Guess 2.*Position 1/)
    assert.throws(() => compile([row("swoon", "y....")], { pattern: "s????" }), /Guess 1.*Advanced clues.*Position 1.*S\./)
    assert.throws(() => compile([], { pattern: "??abc", knownLetters: "abcxy", unknownPatterns: "x????, y????" }), /few positions.*X, Y/)
    assert.throws(() => compile([row("abc", "...")]), /Guess 1.*complete/)
})

test("manual clues merge with board counts and keep multi-letter masks intact", () => {
    const body = compile([row("tales", ".g...")], { knownLetters: "Aa", invalidLetters: "A", unknownPatterns: "Ma???" })
    assert.deepEqual(body, { lang: "en", pattern: "?a???", letters: ["a", "a"], ignore: [..."tlesa"], unknowns: ["ma???"] })
    assert.throws(() => compile([], { knownLetters: "ц" }), /Advanced clues.*selected language/)
    assert.throws(() => compile([], { unknownPatterns: "?a??" }), /Advanced clues.*5 letters/)
    assert.equal(compileClues({ lang: "bg", length: 6, rows: [row("градът", "gggggg")] }).pattern, "градът")
})

// Generate Wordle feedback independently: reserve greens before allocating yellows.
function feedback(guess, answer) {
    const colors = Array(5).fill(".")
    const available = [...answer]
    for (let i = 0; i < 5; i++) {
        if (guess[i] === answer[i]) {
            colors[i] = "g"
            available[i] = null
        }
    }
    for (let i = 0; i < 5; i++) {
        if (colors[i] === "g") continue
        const found = available.indexOf(guess[i])
        if (found !== -1) {
            colors[i] = "y"
            available[found] = null
        }
    }
    return colors.join("")
}

test("compiled guesses with repeated letters agree with Wordle feedback over the bundled dictionary", () => {
    const words = JSON.parse(readFileSync(new URL("../words/words/english5.json", import.meta.url), "utf8"))
    for (const [answer, ...guesses] of [
        ["eerie", "serve", "reuse"], ["llama", "alley", "palms"], ["swoon", "noons", "snowy"],
        ["droll", "drool", "lords"], ["hover", "acrid", "rover"]
    ]) {
        const colors = guesses.map(guess => feedback(guess, answer))
        const expected = new Set(words.filter(word => guesses.every((guess, i) => feedback(guess, word) === colors[i])))
        const body = compile(guesses.map((guess, i) => row(guess, colors[i])))
        const [total, ...rankings] = solve(body.lang, body.pattern, body.letters, body.ignore, body.unknowns)
        assert.equal(total, expected.size, answer)
        assert.ok(rankings.flat().every(([word]) => expected.has(word)), answer)
    }
})
