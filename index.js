const readFileSync = require('fs').readFileSync;
const path = require('path');
const enScores = require('./words/en.scores');
const bgScores = require('./words/bg.scores');

console.log(`
###########################################################################
## Command form: npm run start en c???? has=a,r not=t,i unknown=?a???,??a??
###########################################################################

en                  - supported languages: en|bg
c????               - pattern + length, ? denoting unknown letter
has=a,r             - alphabet, known letters, unknown position
not=t,i             - letters that aren't in the word
unknown=?a???,??a?? - known letters but not possible positions
`)

const lang = process.argv[2] || "en";
let pattern = process.argv[3] || "cra??";
let letters = [];
let ignore = [];
let unknowns = [];

const hasLetters = process.argv.find(x => x.match("has"));
if (hasLetters) {
    letters = hasLetters.replace("has=", "").split(",");
}

const hasIgores = process.argv.find(x => x.match("not"));
if (hasIgores) {
    ignore = hasIgores.replace("not=", "").split(",");
}

const hasUnknowns = process.argv.find(x => x.match("unknown"));
if (hasUnknowns) {
    unknowns = hasUnknowns.replace("unknown=", "").split(",");
}

const wordsFilePath = path.join(__dirname, "words", `${lang}.words.txt`);
const words = readFileSync(wordsFilePath, "utf8")
    .split("\n")
    .filter(x => x === x.toLocaleLowerCase())

const scores = { en: enScores, bg: bgScores }

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

function makeHasPattern(arr) {
    return arr.map(x => `(?=.*${x})`).join("")
}

function makeHasNotPattern(arr) {
    return `((?![${arr.join(",")}]).)*$`
}

const randomPlaceLetters = new RegExp(
    `${makeHasPattern(letters)}.*`,
    "gim"
);

const ignoredLetters = new RegExp(
    `${makeHasNotPattern(ignore)}`,
    "gim"
);

const unknownLetterMap = {
    en: "[a-z]",
    bg: "[а-я]"
}

function makeExactMatchPattern(pat) {
    return new RegExp(
        pat
            .replaceAll("?", unknownLetterMap[lang]),
        "gim"
    )
}

const concreteLetters = makeExactMatchPattern(pattern);

console.log(`
Your input:
lang: ${lang}
pattern: ${pattern}
letters: ${letters}
ignore: ${ignore}

Devised patterns:
concreteLetters: ${concreteLetters}
randomPlaceLetters: ${randomPlaceLetters}
ignoredLetters: ${ignoredLetters}
`)

let result = words.filter(x => x.length === pattern.length)

if (ignore.length > 0) {
    result = result.filter(x => x.match(ignoredLetters)[0].length === pattern.length)
}

if (letters.length > 0) {
    result = result.filter(x => x.match(randomPlaceLetters))
}

unknowns.forEach(x => {
    const filter = makeExactMatchPattern(x);
    result = result.filter(x => !x.match(filter))
})

result = result
    .filter(x => x.match(concreteLetters))

// console.log(
//     JSON.stringify(result, null, 2),
//     `total: ${result.length}`
// );

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

// console.log(repeatedLetters)

function fixNumber(number, fix = 2) {
    return parseFloat(number.toFixed(fix))
}

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

console.log(`### Scoring 1:`)
console.table(
    suggestions1
)

console.log(`### Scoring 2:`)
console.table(
    suggestions2
)
