const readFileSync = require('fs').readFileSync;
const path = require('path');

console.log(`
#############################################
## Command form: npm run start c???? a,r t,i, unknown=?o???
#############################################

c????               - pattern + length, ? denoting unknown letter
has=a,r             - alphabet, known letters, unknown position
not=t,i             - letters that aren't in the word
unknown=?o???,??o?? - known letters but not possible positions
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

const filePath = path.join(__dirname, "words", `${lang}.words.txt`);
const words = readFileSync(filePath, "utf8").split("\n");

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


console.log(
    "\n\n",
    JSON.stringify(result, null, 2),
    `total: ${result.length}`
);
