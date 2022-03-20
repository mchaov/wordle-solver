const readFileSync = require('fs').readFileSync;
const path = require('path');

const enScores = require('./words/en.scores');
const bgScores = require('./words/bg.scores');
const scores = { en: enScores, bg: bgScores }

const bg5 = path.join(__dirname, "words", "words", `words_curated.json`);
const bg6 = path.join(__dirname, "words", "words", `words6_curated.json`);
const en5 = path.join(__dirname, "words", "words", `english5.json`);
const en6 = path.join(__dirname, "words", "words", `english6.json`);
const curatedList = {
    bg: [...JSON.parse(readFileSync(bg5, "utf8")), ...JSON.parse(readFileSync(bg6, "utf8"))],
    en: [...JSON.parse(readFileSync(en5, "utf8")), ...JSON.parse(readFileSync(en6, "utf8"))]
}

// const wordsFilePath = path.join(__dirname, "words", `${lang}.words.txt`);
// const words = readFileSync(wordsFilePath, "utf8")
//     .split("\n")
//     .filter(x => x === x.toLocaleLowerCase())

function makeHasPattern(arr) {
    return arr.map(x => `(?=.*${x})`).join("")
}

function makeHasNotPattern(arr) {
    return `((?![${arr.join(",")}]).)*$`
}

function makeExactMatchPattern(pat, lang) {
    return new RegExp(
        pat
            .replaceAll("?", unknownLetterMap[lang]),
        "gim"
    )
}

function fixNumber(number, fix = 2) {
    return parseFloat(number.toFixed(fix))
}

const unknownLetterMap = {
    en: "[a-z]",
    bg: "[а-я]"
}

function scoreRepeatedLetters(result, letters) {
    const repeatedLetters = {}
    result
        .join("")
        .toLocaleLowerCase()
        .split("")
        .forEach(x => {
            if (!repeatedLetters[x]) {
                repeatedLetters[x] = 0
            }
            if (letters.indexOf(x) === -1) {
                repeatedLetters[x] += 1
            }
        })

    return repeatedLetters
}

function solve(lang, pattern, letters, ignore, unknowns) {

    words = curatedList[lang]

    if (!scores[lang]) {
        words
            .join("")
            .toLocaleLowerCase()
            .split("")
            .forEach(x => {
                if (!scores[lang][x]) {
                    scores[lang][x] = [0, 0]
                }
                scores[lang][x][0] += 1
                scores[lang][x][1] += 1
            })
    }

    const concreteLetters = makeExactMatchPattern(pattern, lang);
    const ignoredLetters = new RegExp(`${makeHasNotPattern(ignore)}`, "gim");
    const randomPlaceLetters = new RegExp(`${makeHasPattern(letters)}.*`, "gim");

    let result = words.filter(x => x.length === pattern.length)

    if (ignore.length > 0) {
        result = result.filter(x => x.match(ignoredLetters)[0].length === pattern.length)
    }

    if (letters.length > 0) {
        result = result.filter(x => x.match(randomPlaceLetters))
    }

    unknowns.forEach(x => {
        const filter = makeExactMatchPattern(x, lang);
        result = result.filter(x => !x.match(filter))
    })

    result = result.filter(x => x.match(concreteLetters))

    const repeatedLetters = scoreRepeatedLetters(result, letters)

    const scored = result
        .map(x => {
            const uniqueLetters = [...new Set(x.split(""))]

            const score = fixNumber(uniqueLetters
                .reduce((a, b) => a + repeatedLetters[b], 0)
            )
            const score2 = fixNumber(x.split("")
                .reduce((a, b) => a + scores[lang][b][1], 0)
            )

            return [x, score, score2]
        })

    const totalToPreview = 15

    const suggestions1 = scored
        .slice()
        .sort((b, a) => a[1] - b[1])
        .slice(0, totalToPreview)

    const suggestions2 = scored
        .slice()
        .sort((b, a) => a[2] - b[2])
        .slice(0, totalToPreview)

    return [scored.length, suggestions1, suggestions2]
}

module.exports = solve