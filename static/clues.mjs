export const marks = ["absent", "elsewhere", "correct"]
export const manualFields = ["pattern", "knownLetters", "invalidLetters", "unknownPatterns"]

const alphabets = { en: "abcdefghijklmnopqrstuvwxyz", bg: "абвгдежзийклмнопрстуфхцчшщъьюя" }
const advanced = "Advanced clues"

export function validWord(word, lang, length) {
    return word.length === length && [...word].every(letter => alphabets[lang].includes(letter))
}

export class ClueError extends Error {
    constructor(message, sources) {
        const unique = [...new Set(sources)]
        super(unique.join(" · ") + " — " + message)
        this.sources = unique
    }
}

function counts(letters) {
    const result = new Map()
    for (const letter of letters) result.set(letter, (result.get(letter) || 0) + 1)
    return result
}

// A suggested color becomes new draft evidence when the player edits that letter.
// Keep its copies together so a repeated letter retains the count the player saw.
export function draftSelections({ word, marks, carriedMarks = [], editedLetters = [...word] }) {
    const edited = new Set(editedLetters)
    const selections = carriedMarks.filter(({ letter }) => !edited.has(letter))
    marks.forEach((mark, slot) => {
        const letter = word[slot]
        if (edited.has(letter) && mark !== "absent") selections.push({ letter, slot, mark })
    })
    return selections
}

export function marksForSuggestion(word, { pattern, letters }, selections = []) {
    const fixed = [...pattern]
    const remaining = counts(letters)
    for (const { letter, slot, mark } of selections) {
        if (mark === "correct" && pattern[slot] === "?") fixed[slot] = letter
    }
    const selectedLetters = selections.map(({ letter }) => letter)
    for (const evidence of [selectedLetters, fixed.filter(letter => letter !== "?")]) {
        for (const [letter, count] of counts(evidence)) {
            remaining.set(letter, Math.max(count, remaining.get(letter) || 0))
        }
    }

    // Reserve fixed copies first, even when another copy occurs earlier in the word.
    const tiles = [...word]
    const feedback = tiles.map((letter, slot) => {
        if (fixed[slot] !== letter) return "absent"
        remaining.set(letter, remaining.get(letter) - 1)
        return "correct"
    })
    function markElsewhere(letter, slot) {
        if (feedback[slot] === "absent" && remaining.get(letter) > 0) {
            feedback[slot] = "elsewhere"
            remaining.set(letter, remaining.get(letter) - 1)
        }
    }
    // Keep a hand-marked yellow on the same copy when replacing a draft.
    for (const { letter, slot, mark } of selections) {
        if (mark === "elsewhere" && letter === tiles[slot]) markElsewhere(letter, slot)
    }
    tiles.forEach(markElsewhere)
    return feedback
}

function readManual(fields, lang, length) {
    const values = Object.fromEntries(manualFields.map(name => [name, (fields[name] || "").trim().toLowerCase()]))
    const pattern = values.pattern || "?".repeat(length)
    const unknowns = values.unknownPatterns.split(",").map(mask => mask.trim()).filter(Boolean)
    const validMask = mask => mask.length === length &&
        [...mask].every(letter => letter === "?" || alphabets[lang].includes(letter))
    if (![pattern, ...unknowns].every(validMask)) {
        throw new ClueError("Use " + length + " letters or ? in each pattern.", [advanced])
    }
    if (![...values.knownLetters, ...values.invalidLetters].every(letter => alphabets[lang].includes(letter))) {
        throw new ClueError("Enter individual letters from the selected language.", [advanced])
    }
    return { pattern, unknowns, letters: values.knownLetters, ignore: values.invalidLetters }
}

// There are at most six slots. Place the remaining required copies to catch
// positional conflicts even when several different letters compete for one slot.
function canPlace(letters, slots, blocked) {
    if (!letters.length) return true
    const [letter, ...rest] = letters
    return slots.some(slot => !blocked[slot].has(letter) &&
        canPlace(rest, slots.filter(other => other !== slot), blocked))
}

export function compileClues({ lang, length, rows, manual = {} }) {
    const fixed = Array(length).fill("?")
    const fixedBy = Array.from({ length }, () => new Set())
    const blocked = Array.from({ length }, () => new Map())
    const minimum = new Map()
    const maximum = new Map()
    const ignored = new Set()
    const forbidden = new Map()

    function fix(slot, letter, source) {
        if (fixed[slot] !== "?" && fixed[slot] !== letter) {
            throw new ClueError("Position " + (slot + 1) + " is marked both " +
                fixed[slot].toUpperCase() + " and " + letter.toUpperCase() + ".", [...fixedBy[slot], source])
        }
        fixed[slot] = letter
        fixedBy[slot].add(source)
    }
    function forbid(mask, source) {
        if (!forbidden.has(mask)) forbidden.set(mask, source)
        const literals = [...mask].filter(letter => letter !== "?")
        if (literals.length === 1) blocked[mask.indexOf(literals[0])].set(literals[0], source)
    }
    function requireCopies(letter, count, sources) {
        if (count > (minimum.get(letter)?.count || 0)) minimum.set(letter, { count, sources })
    }

    rows.forEach(({ word, marks: feedback }, index) => {
        const source = "Guess " + (index + 1)
        if (!validWord(word, lang, length) || feedback.length !== length || !feedback.every(mark => marks.includes(mark))) {
            throw new ClueError("Enter a complete " + length + "-letter guess.", [source])
        }
        const confirmed = counts([...word].filter((_, slot) => feedback[slot] !== "absent"))
        for (const [letter, count] of confirmed) requireCopies(letter, count, [source])
        feedback.forEach((mark, slot) => {
            const letter = word[slot]
            const count = confirmed.get(letter) || 0
            if (mark === "correct") fix(slot, letter, source)
            if (mark === "elsewhere" || (mark === "absent" && count > 0)) {
                forbid("?".repeat(slot) + letter + "?".repeat(length - slot - 1), source)
            }
            if (mark === "absent") {
                ignored.add(letter)
                const cap = maximum.get(letter)
                if (!cap || count < cap.count) maximum.set(letter, { count, source })
            }
        })
    })

    const extra = readManual(manual, lang, length)
    for (const [slot, letter] of [...extra.pattern].entries()) {
        if (letter !== "?") fix(slot, letter, advanced)
    }
    for (const mask of extra.unknowns) forbid(mask, advanced)
    for (const [letter, count] of counts(extra.letters)) requireCopies(letter, count, [advanced])
    for (const letter of extra.ignore) ignored.add(letter)

    for (const [mask, source] of forbidden) {
        if ([...mask].every((letter, slot) => letter === "?" || letter === fixed[slot])) {
            const sources = fixedBy.flatMap((set, slot) => mask[slot] === "?" ? [] : [...set])
            const literals = [...mask].filter(letter => letter !== "?")
            if (literals.length === 1) {
                throw new ClueError("Position " + (mask.indexOf(literals[0]) + 1) + " both requires and excludes " +
                    literals[0].toUpperCase() + ".", [source, ...sources])
            }
            throw new ClueError("Every possible word matches the excluded pattern " + mask.toUpperCase() + ".", [source, ...sources])
        }
    }

    const letters = fixed.filter(letter => letter !== "?")
    const fixedCounts = counts(letters)
    for (const [letter, count] of fixedCounts) {
        const sources = fixedBy.flatMap((set, slot) => fixed[slot] === letter ? [...set] : [])
        requireCopies(letter, count, sources)
    }
    const remaining = []
    for (const [letter, { count, sources }] of minimum) {
        const cap = maximum.get(letter)
        if (cap && cap.count < count) {
            throw new ClueError(letter.toUpperCase() + " is limited to " + cap.count +
                " but needs at least " + count + ".", [cap.source, ...sources])
        }
        for (let i = fixedCounts.get(letter) || 0; i < count; i++) remaining.push(letter)
    }
    const slots = fixed.flatMap((letter, slot) => letter === "?" ? [slot] : [])
    if (remaining.length > slots.length || !canPlace(remaining, slots, blocked)) {
        const sources = [...new Set([
            ...fixedBy.flatMap(set => [...set]),
            ...[...minimum.values()].flatMap(limit => limit.sources),
            ...blocked.flatMap(slot => remaining.flatMap(letter => slot.has(letter) ? [slot.get(letter)] : []))
        ])]
        throw new ClueError("Too few positions are available for " + remaining.join(", ").toUpperCase() + ".", sources)
    }
    return { lang, pattern: fixed.join(""), letters: letters.concat(remaining), ignore: [...ignored], unknowns: [...forbidden.keys()] }
}
