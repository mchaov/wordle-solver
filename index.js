const solve = require("./solver")

console.log(`
###########################################################################
## npm run solve -- en "c????" has=a,r not=t,i "unknown=?a???,??a??"
###########################################################################

en                  - supported languages: en|bg
c????               - pattern + length, ? denoting unknown letter
has=a,r             - known letters, repeated once per confirmed copy
not=t,i             - gray letters, ruling out any copies beyond the confirmed count
unknown=?a???,??a?? - known letters but not possible positions
`)

const [lang = "en", pattern = "?????", ...options] = process.argv.slice(2)

function values(name) {
    const prefix = name + "="
    const option = options.find(value => value.startsWith(prefix))
    return option ? option.slice(prefix.length).split(",").map(value => value.trim()).filter(Boolean) : []
}

try {
    const [total, suggestions1, suggestions2] = solve(lang, pattern, values("has"), values("not"), values("unknown"))
    console.log("Total results:", total)
    console.log("### Scoring 1:")
    console.table(suggestions1)
    console.log("### Scoring 2:")
    console.table(suggestions2)
} catch (error) {
    if (!(error instanceof solve.ClueError)) throw error
    console.error(error.message)
    process.exitCode = 1
}
