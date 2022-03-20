const solve = require("./solver")

console.log(`
###########################################################################
## Command form: npm run sovle en c???? has=a,r not=t,i unknown=?a???,??a??
###########################################################################

en                  - supported languages: en|bg
c????               - pattern + length, ? denoting unknown letter
has=a,r             - alphabet, known letters, unknown position
not=t,i             - letters that aren't in the word
unknown=?a???,??a?? - known letters but not possible positions
`)

const lang = process.argv[2] || "en";
let pattern = process.argv[3] || "?????";
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

const [total, suggestions1, suggestions2] = solve(lang, pattern, letters, ignore, unknowns)

console.log("Total results:", total)

console.log(`### Scoring 1:`)
console.table(
    suggestions1
)

console.log(`### Scoring 2:`)
console.table(
    suggestions2
)