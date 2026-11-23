import { compileClues, draftSelections, manualFields, marks, marksForSuggestion, validWord } from "./clues.mjs"

const $ = id => document.getElementById(id)
const names = { correct: "in place", elsewhere: "elsewhere", absent: "gray, absent or extra copy" }
const symbols = { correct: "✓", elsewhere: "↔", absent: "−" }
const tools = [...document.querySelectorAll("[data-set]")]
const wordInput = $("word")
const history = $("history")
const tiles = $("tiles")
const advanced = $("advanced")
const stackedLayout = window.matchMedia("(max-width: 720px)")
const scoreButtons = [...$("scoreTable").querySelectorAll("thead button")]
const scoreFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 })
let rankings = []
let request
let selected = null
let conflicts = []

function emptyRow(length) {
    return { word: "", marks: Array(length).fill("absent") }
}

function manualValues(values = {}) {
    return Object.fromEntries(manualFields.map(key => [key, typeof values[key] === "string" ? values[key] : ""]))
}

function freshPuzzle(length) {
    return { rows: [], draft: emptyRow(length), edit: null, manual: manualValues(), manualDraft: manualValues(), open: false }
}

function loadSession() {
    let saved
    try { saved = JSON.parse(localStorage.getItem("state")) } catch { /* Storage is optional. */ }
    const lang = saved?.lang === "bg" ? "bg" : "en"
    const length = Number(saved?.length ?? saved?.numberOfLetters) === 6 ? 6 : 5
    if (saved?.version === 2 && saved.puzzles && typeof saved.puzzles === "object") {
        const ranking = [0, 1, 2].includes(saved.ranking) ? saved.ranking : 0
        return { version: 2, lang, length, ranking, puzzles: saved.puzzles }
    }
    const puzzle = freshPuzzle(length)
    puzzle.manual = manualValues(saved || {})
    puzzle.manualDraft = { ...puzzle.manual }
    puzzle.open = Object.values(puzzle.manual).some(Boolean)
    return { version: 2, lang, length, ranking: 0, puzzles: { [lang + length]: puzzle } }
}

const session = loadSession()
let puzzle
function save() {
    try { localStorage.setItem("state", JSON.stringify(session)) } catch { /* Keep playing in memory. */ }
}

function activeRow() {
    return puzzle.edit?.row || puzzle.draft
}

function makeButton(label, className) {
    const button = document.createElement("button")
    button.type = "button"
    button.textContent = label
    button.className = className
    return button
}

function paintTile(tile, row, slot) {
    const letter = row.word[slot]?.toUpperCase() || ""
    const mark = row.marks[slot]
    tile.className = "tile " + (letter ? mark : "empty")
    tile.textContent = letter
    tile.setAttribute("aria-label", "Position " + (slot + 1) + ", " + (letter ? letter + ", " + names[mark] : "empty"))
    if (letter) {
        const symbol = document.createElement("span")
        symbol.className = "tile-symbol"
        symbol.setAttribute("aria-hidden", "true")
        symbol.textContent = symbols[mark]
        tile.append(symbol)
    }
}

function drawRow(container, row) {
    const cells = Array.from({ length: session.length }, (_, slot) => {
        const tile = makeButton("", "tile")
        tile.dataset.slot = slot
        tile.tabIndex = -1
        tile.setAttribute("aria-keyshortcuts", "G Y Delete Backspace ArrowLeft ArrowRight")
        paintTile(tile, row, slot)
        return tile
    })
    container.replaceChildren(...cells)
}

function syncSelection() {
    const row = activeRow()
    const hasLetter = selected !== null && Boolean(row.word[selected])
    Array.from(tiles.children).forEach((tile, slot) => {
        tile.classList.toggle("selected", hasLetter && slot === selected)
        tile.tabIndex = slot === (selected ?? 0) ? 0 : -1
    })
    tools.forEach(button => {
        button.disabled = !hasLetter
        button.setAttribute("aria-pressed", String(hasLetter && row.marks[selected] === button.dataset.set))
    })
}

function renderEditor() {
    const index = puzzle.edit?.index
    $("guessHeading").textContent = index === undefined ? "Guess " + (puzzle.rows.length + 1) : "Editing guess " + (index + 1)
    $("cancelEdit").hidden = index === undefined
    $("applyFeedback").textContent = index === undefined ? "Apply feedback" : "Apply changes"
    wordInput.value = activeRow().word
    $("guessError").textContent = ""
    wordInput.removeAttribute("aria-invalid")
    drawRow(tiles, activeRow())
    syncSelection()
}

function renderHistory() {
    history.replaceChildren()
    puzzle.rows.forEach((row, index) => {
        if (puzzle.edit?.index === index) return
        const label = "Guess " + (index + 1)
        const group = document.createElement("section")
        group.className = "history-row"
        group.classList.toggle("conflict", conflicts.includes(label))
        group.dataset.row = index
        group.setAttribute("aria-label", label)
        const heading = document.createElement("div")
        heading.className = "row-heading"
        const title = document.createElement("h3")
        title.textContent = label
        heading.append(title)
        for (const action of ["Edit", "Remove"]) {
            const button = makeButton(action, "text-button")
            button.dataset.action = action
            button.setAttribute("aria-label", action + " guess " + (index + 1))
            heading.append(button)
        }
        const grid = document.createElement("div")
        grid.className = "tile-row"
        drawRow(grid, row)
        group.append(heading, grid)
        history.append(group)
    })
    advanced.classList.toggle("conflict", conflicts.includes("Advanced clues"))
}

function editRow(index) {
    puzzle.edit = { index, row: { word: puzzle.rows[index].word, marks: [...puzzle.rows[index].marks], editedLetters: [] } }
    selected = null
    renderHistory()
    renderEditor()
    save()
}

function appliedClues() {
    return compileClues({ lang: session.lang, length: session.length, rows: puzzle.rows, manual: puzzle.manual })
}

function pickWord(word) {
    const draft = puzzle.draft
    if (draft.word !== word || !draft.carriedMarks || puzzle.edit) {
        let carriedMarks = draftSelections(draft)
        if (puzzle.edit) carriedMarks = draftSelections({ ...puzzle.edit.row, carriedMarks })
        const marks = marksForSuggestion(word, appliedClues(), carriedMarks)
        puzzle.draft = { word, marks, carriedMarks, editedLetters: [] }
    }
    puzzle.edit = null
    selected = null
    renderHistory()
    renderEditor()
    save()
    tiles.firstElementChild.focus()
}

function setMark(mark) {
    const row = activeRow()
    if (selected === null || !row.word[selected] || row.marks[selected] === mark) return
    row.marks[selected] = mark
    const letter = row.word[selected]
    if (row.editedLetters && !row.editedLetters.includes(letter)) row.editedLetters.push(letter)
    paintTile(tiles.children[selected], row, selected)
    syncSelection()
    save()
}

function activateTile(tile, mark) {
    const slot = Number(tile.dataset.slot)
    const oldRow = tile.closest("[data-row]")
    if (oldRow) editRow(Number(oldRow.dataset.row))
    if (!activeRow().word[slot]) {
        wordInput.focus()
        return
    }
    selected = slot
    tiles.children[slot].focus()
    if (mark) setMark(mark)
    else syncSelection()
}

let pointerType
const board = document.querySelector(".board")
board.addEventListener("pointerdown", event => { pointerType = event.pointerType })
board.addEventListener("click", event => {
    const tile = event.target.closest(".tile")
    if (tile) {
        const touch = event.detail > 0 && (event.pointerType || pointerType) === "touch"
        activateTile(tile, touch ? null : "correct")
    }
})
board.addEventListener("contextmenu", event => {
    const tile = event.target.closest(".tile")
    if (!tile) return
    event.preventDefault()
    activateTile(tile, (event.pointerType || pointerType) === "touch" ? null : "elsewhere")
})
tiles.addEventListener("focusin", event => {
    const tile = event.target.closest(".tile")
    if (tile) {
        selected = Number(tile.dataset.slot)
        syncSelection()
    }
})
board.addEventListener("keydown", event => {
    const tile = event.target.closest(".tile")
    if (!tile || event.ctrlKey || event.altKey || event.metaKey) return
    const shortcuts = { g: "correct", y: "elsewhere", Backspace: "absent", Delete: "absent" }
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
    if (Object.hasOwn(shortcuts, key)) {
        event.preventDefault()
        activateTile(tile, shortcuts[key])
    } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault()
        const neighbor = event.key === "ArrowLeft" ? tile.previousElementSibling : tile.nextElementSibling
        neighbor?.focus()
    }
})
tools.forEach(button => button.addEventListener("click", () => setMark(button.dataset.set)))

wordInput.addEventListener("input", () => {
    const row = activeRow()
    const word = wordInput.value.trim().toLowerCase()
    if (word !== row.word) {
        delete row.carriedMarks
        delete row.editedLetters
    }
    row.marks = row.marks.map((mark, slot) => word[slot] && word[slot] === row.word[slot] ? mark : "absent")
    row.word = word
    if (!word[selected]) selected = null
    $("guessError").textContent = ""
    wordInput.removeAttribute("aria-invalid")
    drawRow(tiles, row)
    syncSelection()
    save()
})

history.addEventListener("click", event => {
    const action = event.target.closest("[data-action]")
    if (!action) return
    const index = Number(action.closest("[data-row]").dataset.row)
    if (action.dataset.action === "Edit") {
        editRow(index)
        wordInput.focus()
    } else {
        puzzle.rows.splice(index, 1)
        if (puzzle.edit && puzzle.edit.index > index) puzzle.edit.index--
        save()
        renderEditor()
        search(true)
    }
})

$("cancelEdit").addEventListener("click", () => {
    puzzle.edit = null
    selected = null
    renderHistory()
    renderEditor()
    save()
    wordInput.focus()
})
$("editor").addEventListener("submit", event => {
    event.preventDefault()
    const row = activeRow()
    if (!validWord(row.word, session.lang, session.length)) {
        const language = session.lang === "bg" ? "Bulgarian" : "English"
        $("guessError").textContent = "Enter a guess with exactly " + session.length + " " + language + " letters."
        wordInput.setAttribute("aria-invalid", "true")
        wordInput.focus()
        return
    }
    const played = { word: row.word, marks: row.marks }
    if (puzzle.edit) {
        puzzle.rows[puzzle.edit.index] = played
        puzzle.edit = null
    } else {
        puzzle.rows.push(played)
        puzzle.draft = emptyRow(session.length)
    }
    selected = null
    save()
    renderEditor()
    search(true)
    if (!stackedLayout.matches && !conflicts.length) wordInput.focus()
})

for (const key of manualFields) {
    $(key).spellcheck = false
    $(key).autocomplete = "off"
    $(key).addEventListener("input", () => {
        puzzle.manualDraft[key] = $(key).value
        save()
    })
}
advanced.addEventListener("toggle", () => {
    puzzle.open = advanced.open
    save()
})
$("manual").addEventListener("submit", event => {
    event.preventDefault()
    puzzle.manual = { ...puzzle.manualDraft }
    save()
    search(true)
})

function renderRanking() {
    scoreButtons.forEach((button, index) => {
        if (index === session.ranking) button.parentElement.setAttribute("aria-sort", "descending")
        else button.parentElement.removeAttribute("aria-sort")
    })
    const shortlists = rankings.map(rows => new Set(rows.map(([word]) => word)))
    const rows = rankings[session.ranking].map(([word, ...scores]) => {
        const row = document.createElement("tr")
        const wordCell = document.createElement("th")
        wordCell.scope = "row"
        const button = makeButton(word.toUpperCase(), "suggestion")
        button.dataset.word = word
        wordCell.append(button)
        row.append(wordCell)
        scores.forEach((score, index) => {
            const cell = row.insertCell()
            const value = scoreFormat.format(score)
            if (shortlists[index].has(word)) {
                const strong = document.createElement("strong")
                strong.textContent = value
                cell.append(strong)
                cell.setAttribute("aria-description", "Top 15 for this score")
            } else {
                cell.textContent = value
            }
        })
        return row
    })
    $("matches").replaceChildren(...rows)
}

scoreButtons.forEach((button, index) => button.addEventListener("click", () => {
    if (!rankings.length || session.ranking === index) return
    session.ranking = index
    save()
    renderRanking()
}))

function showMatches([total, ...lists]) {
    $("matchCount").textContent = total.toLocaleString() + (total === 1 ? " match" : " matches")
    if (!total) {
        $("resultHint").textContent = "Try editing a guess or an advanced clue."
        return
    }
    rankings = lists
    const limit = rankings[session.ranking].length
    $("resultHint").textContent = (total > limit ? "Select a score heading for its top " + limit + "." :
        "Select a score heading to rank the matches.") + " Choose a word, then match its prefilled colors to the game."
    renderRanking()
    $("scoredResults").hidden = false
}
$("matches").addEventListener("click", event => {
    if (!event.target.closest("button") && window.getSelection()?.isCollapsed === false) return
    const suggestion = event.target.closest("tr")?.querySelector("[data-word]")
    if (suggestion) pickWord(suggestion.dataset.word)
})

function refreshInheritedMarks(clues) {
    const draft = puzzle.draft
    if (!draft.carriedMarks) return
    const baseline = marksForSuggestion(draft.word, clues, draft.carriedMarks)
    const updated = baseline.map((mark, slot) => draft.editedLetters.includes(draft.word[slot]) ? draft.marks[slot] : mark)
    if (updated.every((mark, slot) => mark === draft.marks[slot])) return
    draft.marks = updated
    if (!puzzle.edit) {
        drawRow(tiles, draft)
        syncSelection()
    }
    save()
}

async function search(reveal = false) {
    request?.abort()
    request = undefined
    const results = $("results")
    results.removeAttribute("aria-busy")
    rankings = []
    $("scoredResults").hidden = true
    $("matches").replaceChildren()
    $("matchCount").textContent = "Matches"
    $("retry").hidden = true
    $("clueError").textContent = ""
    $("searchError").textContent = ""
    conflicts = []
    let payload
    try {
        payload = appliedClues()
    } catch (error) {
        conflicts = error.sources || []
        $("clueError").textContent = error.message
        $("resultHint").textContent = "Review the highlighted clues."
        renderHistory()
        if (reveal) $("clueError").focus()
        return
    }
    refreshInheritedMarks(payload)
    renderHistory()
    const current = new AbortController()
    request = current
    results.setAttribute("aria-busy", "true")
    $("resultHint").textContent = "Finding words…"
    try {
        const response = await fetch("/parse", {
            method: "POST", headers: { "Content-Type": "application/json" },
            signal: current.signal, body: JSON.stringify(payload)
        })
        const data = await response.json()
        if (request !== current) return
        if (!response.ok) throw new Error(data.error || "The search could not be completed.")
        showMatches(data)
        if (reveal && stackedLayout.matches) $("matchCount").focus()
    } catch (error) {
        if (request !== current) return
        $("resultHint").textContent = ""
        $("searchError").textContent = error instanceof TypeError ? "Could not reach the solver." : error.message
        $("retry").hidden = false
        if (reveal && stackedLayout.matches) $("searchError").focus()
    } finally {
        if (request === current) {
            request = undefined
            results.removeAttribute("aria-busy")
        }
    }
}
$("retry").addEventListener("click", () => search(true))

function openPuzzle(lang, length) {
    session.lang = lang
    session.length = length
    const key = lang + length
    puzzle = session.puzzles[key] ||= freshPuzzle(length)
    selected = null
    $("lang").value = lang
    $("numberOfLetters").value = String(length)
    document.documentElement.style.setProperty("--length", length)
    wordInput.lang = lang
    advanced.open = puzzle.open
    for (const field of manualFields) $(field).value = puzzle.manualDraft[field]
    $("pattern").placeholder = "?".repeat(length)
    const letter = lang === "bg" ? "а" : "a"
    $("unknownHint").textContent = "Separate patterns with commas, for example " +
        "?" + letter + "?".repeat(length - 2) + ", ??" + letter + "?".repeat(length - 3) + "."
    renderEditor()
    search()
    save()
}
for (const id of ["lang", "numberOfLetters"]) {
    $(id).addEventListener("change", () => openPuzzle($("lang").value, Number($("numberOfLetters").value)))
}
$("newPuzzle").addEventListener("click", () => {
    session.puzzles[session.lang + session.length] = freshPuzzle(session.length)
    openPuzzle(session.lang, session.length)
    wordInput.focus()
})
openPuzzle(session.lang, session.length)
