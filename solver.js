const enScores = require("./words/en.scores")
const bgScores = require("./words/bg.scores")
const alphabets = { en: new Set(Object.keys(enScores)), bg: new Set(Object.keys(bgScores)) }

function countLetters(letters) {
    const counts = new Map()
    for (const letter of letters) counts.set(letter, (counts.get(letter) || 0) + 1)
    return counts
}

function prepareWords(words, scores) {
    return words.map(word => {
        let languageScore = 0
        for (const letter of word) languageScore += scores[letter][1]
        return {
            word,
            letterCounts: countLetters(word),
            languageScore: Number(languageScore.toFixed(2))
        }
    })
}

const dictionaries = {
    en: {
        5: prepareWords(require("./words/words/english5.json"), enScores),
        6: prepareWords(require("./words/words/english6.json"), enScores)
    },
    bg: {
        5: prepareWords(require("./words/words/words_curated.json"), bgScores),
        6: prepareWords(require("./words/words/words6_curated.json"), bgScores)
    }
}

class ClueError extends Error {}

function matchesPattern(word, pattern) {
    for (let i = 0; i < pattern.length; i++) {
        if (pattern[i] !== "?" && pattern[i] !== word[i]) return false
    }
    return true
}

function matchesLetterLimits(counts, limits) {
    for (const { letter, minimum, maximum } of limits) {
        const count = counts.get(letter) || 0
        if (count < minimum || count > maximum) return false
    }
    return true
}

function normalizeLetters(values, alphabet) {
    if (!Array.isArray(values) || !values.every(value =>
        typeof value === "string" && value.length === 1 && alphabet.has(value.toLowerCase())
    )) {
        throw new ClueError("Use individual letters from the selected language for Known letters and Invalid letters.")
    }
    return values.map(value => value.toLowerCase())
}

function solve(lang, pattern, letters = [], ignore = [], unknowns = []) {
    if (lang !== "en" && lang !== "bg") throw new ClueError("Choose English (en) or Bulgarian (bg).")
    const alphabet = alphabets[lang]
    const validPattern = value => typeof value === "string" && value.length > 0 &&
        [...value].every(c => c === "?" || alphabet.has(c.toLowerCase()))
    if (!validPattern(pattern)) throw new ClueError("Use letters and ? in the word pattern.")
    if (!Array.isArray(unknowns) || !unknowns.every(mask => validPattern(mask) && mask.length === pattern.length)) {
        throw new ClueError("Each Impossible places pattern must have the same length as the word.")
    }

    const fixed = pattern.toLowerCase()
    const fixedCounts = countLetters(fixed)
    const requiredCounts = countLetters(normalizeLetters(letters, alphabet))
    const grayLetters = new Set(normalizeLetters(ignore, alphabet))
    const forbiddenPositions = unknowns.map(mask => mask.toLowerCase())
    const constrainedLetters = new Set([...requiredCounts.keys(), ...grayLetters])
    const limits = Array.from(constrainedLetters, letter => {
        // Known letters may include copies already shown in the pattern.
        const minimum = Math.max(fixedCounts.get(letter) || 0, requiredCounts.get(letter) || 0)
        return { letter, minimum, maximum: grayLetters.has(letter) ? minimum : Infinity }
    })

    const pool = dictionaries[lang][fixed.length] || []
    const candidates = pool.filter(({ word, letterCounts }) => matchesPattern(word, fixed) &&
        matchesLetterLimits(letterCounts, limits) &&
        !forbiddenPositions.some(mask => matchesPattern(word, mask)))

    const counts = Object.create(null)
    for (const { word } of candidates) {
        for (const letter of word) counts[letter] = (counts[letter] || 0) + 1
    }
    for (const letter of requiredCounts.keys()) counts[letter] = 0

    const scored = candidates.map(({ word, letterCounts, languageScore }) => {
        let uniqueScore = 0
        let totalScore = 0
        for (const [letter, copies] of letterCounts) {
            uniqueScore += counts[letter]
            totalScore += counts[letter] * copies
        }
        return [word, uniqueScore, languageScore, totalScore]
    })
    const rankings = [1, 2, 3].map(index =>
        scored.slice().sort((a, b) => b[index] - a[index]).slice(0, 15)
    )
    return [scored.length, ...rankings]
}

module.exports = solve
module.exports.ClueError = ClueError
