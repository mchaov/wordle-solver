const readFileSync = require('fs').readFileSync;
const path = require('path');

console.log(`
#############################################
## Command form: npm run start c???? a,r t,i
#############################################

c????   - pattern + length, ? denoting unknown letter
a,r     - alphabet, known letters, unknown position
t,i     - letters that aren't in the word

`)

const lang = process.argv[2] || "en";
let pattern = process.argv[3] || "cra??";
let letters = [];
let ignore = [];

const hasLetters = process.argv.find(x => x.match("has"));
if (hasLetters) {
    letters = hasLetters.replace("has=", "").split(",");
}

const hasIgores = process.argv.find(x => x.match("not"));
if (hasIgores) {
    ignore = hasIgores.replace("not=", "").split(",");
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
const concreteLetters = new RegExp(pattern
    .replaceAll("?", unknownLetterMap[lang]),
    "gim"
);

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

result = result.filter(x => x.match(concreteLetters))


console.log("\n\n", result);
