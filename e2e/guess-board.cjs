const test = require("node:test")
const assert = require("node:assert/strict")
const { chromium } = require("playwright")
const startServer = require("../test-support/server.cjs")

const isSearch = message => new URL(message.url()).pathname === "/parse"
const empty = { lang: "en", pattern: "?????", letters: [], ignore: [], unknowns: [] }

function draftMarks(page) {
    return page.locator("#tiles button").evaluateAll(tiles =>
        tiles.map(tile => ["correct", "elsewhere", "absent"].find(mark => tile.classList.contains(mark))))
}

test("Guess Board in Chromium", async t => {
    const origin = await startServer(t)
    const browser = await chromium.launch()
    t.after(() => browser.close())

    async function open(t, { contextOptions, legacy } = {}) {
        const context = await browser.newContext(contextOptions)
        t.after(() => context.close())
        await context.route("https://www.googletagmanager.com/**", route => route.fulfill({
            contentType: "application/javascript", body: ""
        }))
        if (legacy) await context.addInitScript(state => {
            if (!localStorage.getItem("state")) localStorage.setItem("state", JSON.stringify(state))
        }, legacy)
        const page = await context.newPage()
        page.setDefaultTimeout(5000)
        const requests = []
        const errors = []
        page.on("request", req => { if (isSearch(req)) requests.push(req.postDataJSON()) })
        page.on("pageerror", error => errors.push(error.message))
        t.after(() => assert.deepEqual(errors, []))
        async function searchAfter(action) {
            const [response] = await Promise.all([page.waitForResponse(isSearch), action()])
            assert.equal(response.status(), 200)
            await response.finished()
            await page.waitForFunction(() => document.querySelector("#results")?.getAttribute("aria-busy") !== "true" &&
                /match/i.test(document.querySelector("#matchCount")?.textContent) &&
                document.querySelector("#matchCount")?.textContent !== "Matches")
            return response.request().postDataJSON()
        }
        await searchAfter(() => page.goto(origin))
        return {
            page, requests, searchAfter, input: page.getByRole("textbox", { name: "Your guess" }),
            tile: index => page.locator("#tiles button").nth(index),
            button: name => page.getByRole("button", { name, exact: true }),
            apply: () => page.locator("#applyFeedback").click()
        }
    }

    await t.test("mouse gestures, exact outgoing clues, results, draft selection and removal", async t => {
        const { page, requests, searchAfter, input, tile, button, apply } = await open(t)
        assert.deepEqual(requests, [empty])
        assert.equal(await page.locator("#matches button").count(), 15)
        assert.equal(await page.locator("#advanced").getAttribute("open"), null)
        await input.fill("ac")
        await apply()
        assert.match(await page.locator("#guessError").innerText(), /5 English letters/)
        await input.fill("ACRID")
        await tile(2).click()
        await tile(2).click()
        assert.equal(await tile(2).getAttribute("aria-label"), "Position 3, R, in place")
        await tile(2).click({ button: "right" })
        await tile(2).click({ button: "right" })
        assert.match(await tile(2).getAttribute("aria-label"), /elsewhere/)
        const contextMenuAllowed = el => el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }))
        assert.equal(await tile(2).evaluate(contextMenuAllowed), false)
        assert.equal(await input.evaluate(contextMenuAllowed), true)
        await button("Clear mark").click()
        assert.match(await tile(2).getAttribute("aria-label"), /gray/)
        await tile(2).click({ button: "right" })
        assert.equal(requests.length, 1)
        const first = { ...empty, letters: ["r"], ignore: [..."acid"], unknowns: ["??r??"] }
        assert.deepEqual(await searchAfter(apply), first)

        await input.fill("ROVER")
        for (const slot of [1, 2, 3, 4]) await tile(slot).click()
        const both = { lang: "en", pattern: "?over", letters: [..."over"], ignore: [..."acidr"], unknowns: ["??r??", "r????"] }
        assert.deepEqual(await searchAfter(apply), both)
        assert.equal(await page.locator("#matchCount").innerText(), "3 matches")
        assert.deepEqual(await page.locator("#matches button").evaluateAll(buttons => buttons.map(b => b.dataset.word)),
            ["hover", "lover", "mover"])
        await button("HOVER").click()
        assert.equal(await input.inputValue(), "hover")
        const over = ["absent", "correct", "correct", "correct", "correct"]
        assert.deepEqual(await draftMarks(page), over)
        assert.equal(requests.length, 3)
        assert.deepEqual(await searchAfter(() => page.reload()), both)
        assert.equal(await input.inputValue(), "hover")
        assert.deepEqual(await draftMarks(page), over)
        await button("Edit guess 2").click()
        await tile(4).click({ button: "right" })
        await button("Cancel edit").click()
        assert.equal(await input.inputValue(), "hover")
        assert.equal(requests.length, 4)
        assert.deepEqual(await searchAfter(() => button("Remove guess 1").click()), {
            ...both, ignore: ["r"], unknowns: ["r????"]
        })
        assert.deepEqual(await draftMarks(page), over)
        await tile(0).click()
        assert.deepEqual(await searchAfter(() => button("Remove guess 1").click()), empty)
        assert.deepEqual(await draftMarks(page), ["correct", "absent", "absent", "absent", "absent"])
    })

    await t.test("a side-panel pick carries draft and applied marks and submits only on Apply feedback", async t => {
        const { page, requests, searchAfter, input, tile, button, apply } = await open(t)
        await input.fill("raise")
        await tile(0).click({ button: "right" })
        await tile(2).click()
        await page.getByRole("row").filter({ has: button("ARISE") }).getByRole("cell").first().click()
        assert.deepEqual(await draftMarks(page), ["absent", "elsewhere", "correct", "absent", "absent"])
        await button("Rank by language").click()
        await button("AERIE").click()
        assert.deepEqual(await draftMarks(page), ["absent", "absent", "elsewhere", "elsewhere", "absent"])
        await tile(3).click({ button: "right" })
        await button("Rank by coverage").click()
        await button("ARISE").click()
        assert.deepEqual(await draftMarks(page), ["absent", "elsewhere", "correct", "absent", "absent"])
        assert.deepEqual(requests, [empty])
        await tile(1).click()
        assert.deepEqual(await searchAfter(apply), {
            ...empty, pattern: "?ri??", letters: ["r", "i"], ignore: [..."ase"]
        })
        await button("PRINT").focus()
        await page.keyboard.press("Enter")
        assert.deepEqual(await draftMarks(page), ["absent", "correct", "correct", "absent", "absent"])
        assert.equal(await page.locator("#history [data-row]").count(), 1)
        assert.equal(requests.length, 2)
        assert.deepEqual(await searchAfter(apply), {
            ...empty, pattern: "?ri??", letters: ["r", "i"], ignore: [..."asepnt"]
        })
    })

    await t.test("browsing suggestions preserves selected copies without changing the played guess", async t => {
        const { page, requests, searchAfter, input, tile, button, apply } = await open(t)
        await input.fill("zzzzz")
        await searchAfter(apply)
        await button("Rank by language").click()
        await button("Edit guess 1").click()
        await input.fill("eerie")
        await tile(4).click({ button: "right" })
        await button("EERIE").click()
        const oneE = ["absent", "absent", "absent", "absent", "elsewhere"]
        assert.deepEqual(await draftMarks(page), oneE)
        assert.match(await page.locator("#history button.tile").first().getAttribute("aria-label"), /Z, gray/)
        assert.equal(requests.length, 2)

        await page.locator("#advanced summary").click()
        await page.getByLabel("Known letters", { exact: true }).fill("e")
        await searchAfter(() => button("Apply clues").click())
        await button("TEPEE").click()
        assert.deepEqual(await draftMarks(page), oneE)
        await tile(3).click()
        await searchAfter(() => page.reload())
        assert.deepEqual(await draftMarks(page), ["absent", "absent", "absent", "correct", "elsewhere"])
        await button("EERIE").click()
        assert.deepEqual(await draftMarks(page), ["elsewhere", "absent", "absent", "absent", "elsewhere"])
        assert.equal(requests.length, 4)
    })

    await t.test("a six-letter English suggestion carries both copies and its fixed positions", async t => {
        const { page, searchAfter, input, button } = await open(t)
        await searchAfter(() => page.getByLabel("Word length").selectOption("6"))
        assert.equal((await page.locator("#matchCount").innerText()).replace(/\D/g, ""), "14822")
        await page.locator("#advanced summary").click()
        await page.getByLabel("Pattern", { exact: true }).fill("qu?s?r")
        await page.getByLabel("Known letters", { exact: true }).fill("aa")
        await searchAfter(() => button("Apply clues").click())
        assert.equal(await page.locator("#matchCount").innerText(), "1 match")
        await button("QUASAR").click()
        assert.equal(await input.inputValue(), "quasar")
        assert.deepEqual(await draftMarks(page), ["correct", "correct", "elsewhere", "correct", "elsewhere", "correct"])
    })

    await t.test("each scoring rule shows its own ranked words, exact scores and shortlist overlaps", async t => {
        const { page, requests, searchAfter, input, button } = await open(t)
        const response = await page.request.post(origin + "/parse", { data: empty })
        assert.equal(response.status(), 200)
        const [, ...rankings] = await response.json()
        const shortlists = rankings.map(rows => new Set(rows.map(([word]) => word)))
        const locale = await page.evaluate(() => new Intl.NumberFormat().resolvedOptions().locale)
        const format = new Intl.NumberFormat(locale)
        const headings = ["Rank by coverage", "Rank by language", "Rank by all letters"]
        const selected = page.locator('#scoreTable th[aria-sort="descending"] button')
        assert.equal(await selected.getAttribute("aria-label"), headings[0])
        await page.getByText("How scores work", { exact: true }).click()
        assert.deepEqual(await page.locator("#scoreGuide dt").allInnerTexts(),
            ["Coverage · Score 1", "Language · Score 2", "All letters · Score 3"])

        for (const [index, heading] of headings.entries()) {
            await button(heading).focus()
            await page.keyboard.press("Enter")
            assert.equal(await selected.getAttribute("aria-label"), heading)
            const actual = await page.locator("#matches tr").evaluateAll(rows => rows.map(row => ({
                word: row.querySelector("button").dataset.word,
                values: [...row.querySelectorAll("td")].map(cell => cell.textContent),
                shortlisted: [...row.querySelectorAll("td")].map(cell => Boolean(cell.querySelector("strong")))
            })))
            assert.deepEqual(actual, rankings[index].map(([word, ...scores]) => ({
                word, values: scores.map(score => format.format(score)),
                shortlisted: shortlists.map(list => list.has(word))
            })))
        }
        const other = rankings[2].find(([word]) => !shortlists[0].has(word))
        assert.ok(other, "the All letters shortlist includes a word outside the Coverage shortlist")
        const [otherWord] = other
        const otherRow = page.getByRole("row").filter({ has: button(otherWord.toUpperCase()) })
        await otherRow.getByRole("cell").last().click()
        assert.equal(await input.inputValue(), otherWord)
        assert.deepEqual(requests, [empty])
        await searchAfter(() => page.reload())
        assert.equal(await selected.getAttribute("aria-label"), headings[2])
        assert.equal(await input.inputValue(), otherWord)
    })

    await t.test("a gray duplicate caps a letter and conflicting rows stay editable without sending a request", async t => {
        const { page, requests, searchAfter, input, tile, button, apply } = await open(t)
        await input.fill("array")
        await tile(0).click({ button: "right" })
        assert.deepEqual(await searchAfter(apply), { ...empty, letters: ["a"], ignore: [..."ray"], unknowns: ["a????", "???a?"] })
        await input.fill("abaca")
        await tile(2).click()
        await tile(4).click()
        await apply()
        assert.match(await page.locator("#clueError").innerText(), /Guess 1.*Guess 2.*A is limited to 1/)
        assert.equal(requests.length, 2)
        assert.equal(await page.locator("#matches button").count(), 0)
        assert.equal(await page.locator("#scoredResults").isVisible(), false)
        await button("Edit guess 2").click()
        await tile(4).focus()
        await button("Clear mark").click()
        assert.deepEqual(await searchAfter(apply), {
            ...empty, pattern: "??a??", letters: ["a"], ignore: [..."raybc"], unknowns: ["a????", "???a?", "????a"]
        })
        assert.equal(await page.locator("#clueError").innerText(), "")
    })

    await t.test("legacy manual clues combine with keyboard feedback and restore after reload", async t => {
        const { page, requests, searchAfter, input, tile, button, apply } = await open(t, {
            legacy: { lang: "en", numberOfLetters: "5", pattern: "????t", knownLetters: "tle", invalidLetters: "carsoinf", searched: true }
        })
        const legacy = { lang: "en", pattern: "????t", letters: [..."tle"], ignore: [..."carsoinf"], unknowns: [] }
        assert.deepEqual(requests, [legacy])
        assert.ok(await page.locator("#advanced").evaluate(el => el.open))
        assert.ok(await button("VELDT").isVisible())
        await button("VELDT").click()
        assert.deepEqual(await draftMarks(page), ["absent", "elsewhere", "elsewhere", "absent", "correct"])
        await page.locator("#advanced summary").click()
        await input.fill("veldt")
        await tile(0).focus()
        await page.keyboard.press("y")
        await page.keyboard.press("Tab")
        await page.keyboard.press("Enter")
        assert.match(await tile(0).getAttribute("aria-label"), /in place/)
        await tile(0).focus()
        for (let i = 1; i < 5; i++) {
            await page.keyboard.press("ArrowRight")
            await page.keyboard.press("g")
        }
        const exact = { ...legacy, pattern: "veldt", letters: [..."veldt"] }
        assert.deepEqual(await searchAfter(apply), exact)
        assert.equal(await page.locator("#matchCount").innerText(), "1 match")
        const cells = page.locator("#matches td")
        assert.equal(await cells.nth(0).innerText(), "0")
        assert.equal(await cells.nth(2).innerText(), "0")
        await input.fill("ve")
        assert.deepEqual(await searchAfter(() => page.reload()), exact)
        assert.equal(await input.inputValue(), "ve")
        assert.equal(await page.locator("#advanced").getAttribute("open"), null)

        await page.locator("#advanced summary").click()
        await page.getByLabel("Pattern", { exact: true }).fill("????v")
        await button("Apply clues").click()
        assert.match(await page.locator("#clueError").innerText(), /Guess 1.*Advanced clues.*Position 5/)
        assert.equal(requests.length, 3)
        await page.getByLabel("Pattern", { exact: true }).fill("")
        assert.deepEqual(await searchAfter(() => button("Apply clues").click()), exact)
        assert.equal(await input.inputValue(), "ve")
    })

    await t.test("all-gray feedback, empty matches and retrying the same search", async t => {
        const { page, input, tile, button, searchAfter, apply } = await open(t)
        await input.fill("swoon")
        await tile(2).click()
        await page.keyboard.press("Delete")
        const allGray = { ...empty, ignore: [..."swon"] }
        assert.deepEqual(await searchAfter(apply), allGray)
        await page.locator("#advanced summary").click()
        await page.getByLabel("Pattern", { exact: true }).fill("zzzzz")
        const zero = { ...allGray, pattern: "zzzzz", letters: [..."zzzzz"] }
        assert.deepEqual(await searchAfter(() => button("Apply clues").click()), zero)
        assert.equal(await page.locator("#matchCount").innerText(), "0 matches")
        assert.equal(await page.locator("#scoredResults").isVisible(), false)
        assert.equal(await page.locator("#clueError").innerText(), "")

        await page.route("**/parse", route => route.abort("failed"), { times: 1 })
        await button("Apply clues").click()
        await button("Try again").waitFor()
        assert.match(await page.locator("#searchError").innerText(), /reach the solver/)
        assert.deepEqual(await searchAfter(() => button("Try again").click()), zero)
        assert.equal(await page.locator("#searchError").innerText(), "")
    })

    await t.test("removing a guess while its search is pending displays the current board", async t => {
        const { page, input, button, searchAfter, apply } = await open(t)
        const initialCount = await page.locator("#matchCount").innerText()
        let intercept
        const pending = new Promise(resolve => { intercept = resolve })
        await page.route("**/parse", route => intercept(route), { times: 1 })
        await input.fill("acrid")
        await apply()
        const route = await pending
        assert.deepEqual(route.request().postDataJSON(), { ...empty, ignore: [..."acrid"] })
        assert.deepEqual(await searchAfter(() => button("Remove guess 1").click()), empty)
        await route.fulfill({ json: [0, [], [], []] })
        assert.equal(await page.locator("#matches button").count(), 15)
        assert.equal(await page.locator("#matchCount").innerText(), initialCount)
    })

    await t.test("touch controls, six-letter Bulgarian puzzles and narrow layout", async t => {
        const { page, requests, searchAfter, input, tile, button, apply } = await open(t, {
            contextOptions: { hasTouch: true, isMobile: true, viewport: { width: 320, height: 750 } }
        })
        await input.fill("swoon")
        await searchAfter(() => page.getByRole("combobox", { name: "Language", exact: true }).selectOption("bg"))
        await searchAfter(() => page.getByLabel("Word length").selectOption("6"))
        assert.equal(await page.locator("#tiles button").count(), 6)
        assert.equal(await page.locator(".touch-hint").isVisible(), true)
        await button("Rank by language").tap()
        assert.equal(await page.locator("#matches tr").first().locator("td").count(), 3)
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        const board = await page.locator(".board").boundingBox()
        const matches = await page.locator("#results").boundingBox()
        assert.ok(matches.y >= board.y + board.height)
        await input.fill("ГРАДЪТ")
        await tile(4).tap()
        assert.match(await tile(4).getAttribute("aria-label"), /Ъ, gray/)
        await button("Elsewhere").tap()
        assert.match(await tile(4).getAttribute("aria-label"), /elsewhere/)
        await button("Clear mark").tap()
        assert.match(await tile(4).getAttribute("aria-label"), /gray/)
        await button("In place").tap()
        assert.equal(requests.length, 3)
        const body = { lang: "bg", pattern: "????ъ?", letters: ["ъ"], ignore: [..."градт"], unknowns: [] }
        assert.deepEqual(await searchAfter(apply), body)
        assert.equal(await page.locator(":focus").getAttribute("id"), "matchCount")
        assert.ok(await page.locator("#matchCount").evaluate(el => el.getBoundingClientRect().bottom <= innerHeight))
        assert.deepEqual(await searchAfter(() => page.reload()), body)
        await searchAfter(() => page.getByRole("combobox", { name: "Language", exact: true }).selectOption("en"))
        await searchAfter(() => page.getByLabel("Word length").selectOption("5"))
        assert.equal(await input.inputValue(), "swoon")
        assert.deepEqual(await searchAfter(() => button("New puzzle").click()), empty)
        assert.equal(await input.inputValue(), "")
    })
})
