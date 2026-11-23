const form = document.getElementById("wordConfig")
const fields = ["lang", "numberOfLetters", "pattern", "knownLetters", "invalidLetters", "unknownPatterns"]
const results = document.querySelector(".tables")
const errorMessage = document.getElementById("queryError")
let pendingSearch

function readClues() {
    return Object.fromEntries(fields.map(id => [id, form.elements.namedItem(id).value]))
}

function populateForm(saved = {}) {
    for (const id of fields) {
        form.elements.namedItem(id).value = typeof saved[id] === "string" ? saved[id] : ""
    }
    form.elements.lang.value = saved.lang === "bg" ? "bg" : "en"
    form.elements.numberOfLetters.value = Number(saved.numberOfLetters) === 6 ? "6" : "5"
    form.elements.pattern.placeholder = "?".repeat(Number(form.elements.numberOfLetters.value))
}

function saveClues(searched) {
    try {
        localStorage.setItem("state", JSON.stringify({ ...readClues(), searched }))
    } catch {
        // Searching also works when browser storage is unavailable.
    }
}

function clearResults() {
    if (pendingSearch) pendingSearch.abort()
    pendingSearch = undefined
    errorMessage.textContent = ""
    results.replaceChildren()
    results.removeAttribute("aria-busy")
}

function scoreTable(rows, ranking, appearances) {
    const table = document.createElement("table")
    table.className = "tbl"
    const header = table.createTHead().insertRow()
    for (const [index, title] of ["Word", "Score 1", "Score 2", "Score 3"].entries()) {
        const cell = document.createElement("th")
        cell.scope = "col"
        cell.textContent = title
        if (index) cell.className = index === ranking ? "red" : "gray"
        header.append(cell)
    }
    const body = table.createTBody()
    for (const scores of rows) {
        const row = body.insertRow()
        for (const [index, value] of scores.entries()) {
            const cell = row.insertCell()
            cell.textContent = value
            if (index) cell.className = index === ranking ? "red" : "gray"
            else if (appearances.get(value) > 1) cell.className = "isRepeated"
        }
    }
    return table
}

function showResults([total, ...rankings]) {
    const heading = document.createElement("h3")
    heading.textContent = total ? "Total words: " + total : "No words match these clues."
    results.replaceChildren(heading)
    if (!total) return

    const appearances = new Map()
    for (const rows of rankings) {
        for (const word of new Set(rows.map(row => row[0]))) {
            appearances.set(word, (appearances.get(word) || 0) + 1)
        }
    }
    rankings.forEach((rows, index) => results.append(scoreTable(rows, index + 1, appearances)))
}

async function search() {
    clearResults()
    const clues = readClues()
    const length = Number(clues.numberOfLetters)
    const pattern = clues.pattern.trim() || "?".repeat(length)
    if (pattern.length !== length) {
        errorMessage.textContent = "The pattern needs " + length + " positions. Use ? for each unknown letter."
        return
    }

    const request = new AbortController()
    pendingSearch = request
    results.setAttribute("aria-busy", "true")
    try {
        const response = await fetch("/parse", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: request.signal,
            body: JSON.stringify({
                lang: clues.lang,
                pattern,
                letters: [...clues.knownLetters.trim()],
                ignore: [...clues.invalidLetters.trim()],
                unknowns: clues.unknownPatterns.split(",").map(mask => mask.trim()).filter(Boolean)
            })
        })
        const payload = await response.json()
        if (pendingSearch !== request) return
        if (!response.ok) {
            errorMessage.textContent = payload.error || "The word search could not be completed."
            return
        }
        showResults(payload)
        saveClues(true)
    } catch {
        if (pendingSearch === request) errorMessage.textContent = "Could not reach the solver. Try Find again."
    } finally {
        if (pendingSearch === request) {
            pendingSearch = undefined
            results.removeAttribute("aria-busy")
        }
    }
}

form.addEventListener("input", ({ target }) => {
    if (target.id === "lang") populateForm({ lang: target.value })
    if (target.id === "numberOfLetters") form.elements.pattern.placeholder = "?".repeat(Number(target.value))
    clearResults()
    saveClues(false)
})

form.addEventListener("submit", event => {
    event.preventDefault()
    search()
})

document.getElementById("reset").addEventListener("click", () => {
    clearResults()
    populateForm()
    saveClues(false)
})

let saved
try {
    saved = JSON.parse(localStorage.getItem("state"))
} catch {
    // A saved search is optional.
}
populateForm(saved || {})
if (saved && (saved.searched === true || (Array.isArray(saved.result) && saved.result.length))) search()
