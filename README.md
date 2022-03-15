# wordle-solver

- [wordle-solver](#wordle-solver)
  - [Usage](#usage)

## Usage

```bash
###########################################################################
## Command form: npm run start en c???? has=a,r not=t,i unknown=?a???,??a??
###########################################################################

# en                  - supported languages: en|bg
# c????               - pattern + length, ? denoting unknown letter
# has=a,r             - alphabet, known letters, unknown position
# not=t,i             - letters that aren't in the word
# unknown=?a???,??a?? - known letters but not possible positions

npm run start c???? has=a,r not=t,i, unknown=?a???,??a??

# output:

Your input:
lang: en
pattern: c????
letters: a,r
ignore: t,i

Devised patterns:
concreteLetters: /c[a-z][a-z][a-z][a-z]/gim
randomPlaceLetters: /(?=.*a)(?=.*r).*/gim
ignoredLetters: /((?![t,i]).)*$/gim

### Scoring 1:
┌─────────┬─────────┬────┬────────┐
│ (index) │    0    │ 1  │   2    │
├─────────┼─────────┼────┼────────┤
│    0    │ 'ceral' │ 31 │ 189.94 │
│    1    │ 'clear' │ 31 │ 189.94 │
│    2    │ 'ceras' │ 30 │ 191.19 │
│    3    │ 'coran' │ 30 │ 175.51 │
│    4    │ 'cread' │ 30 │ 179.21 │
│    5    │ 'creak' │ 30 │ 167.57 │
│    6    │ 'cream' │ 30 │ 177.32 │
│    7    │ 'creda' │ 30 │ 179.21 │
│    8    │ 'crena' │ 30 │ 195.88 │
│    9    │ 'croak' │ 30 │ 147.2  │
│   10    │ 'crosa' │ 30 │ 170.82 │
│   11    │ 'copra' │ 29 │ 157.73 │
│   12    │ 'corah' │ 29 │ 156.9  │
│   13    │ 'coroa' │ 28 │ 178.1  │
│   14    │ 'crcao' │ 28 │ 164.72 │
└─────────┴─────────┴────┴────────┘
### Scoring 2:
┌─────────┬─────────┬────┬────────┐
│ (index) │    0    │ 1  │   2    │
├─────────┼─────────┼────┼────────┤
│    0    │ 'crena' │ 30 │ 195.88 │
│    1    │ 'ceras' │ 30 │ 191.19 │
│    2    │ 'ceral' │ 31 │ 189.94 │
│    3    │ 'clear' │ 31 │ 189.94 │
│    4    │ 'cread' │ 30 │ 179.21 │
│    5    │ 'creda' │ 30 │ 179.21 │
│    6    │ 'coroa' │ 28 │ 178.1  │
│    7    │ 'cream' │ 30 │ 177.32 │
│    8    │ 'coran' │ 30 │ 175.51 │
│    9    │ 'crosa' │ 30 │ 170.82 │
│   10    │ 'creak' │ 30 │ 167.57 │
│   11    │ 'crcao' │ 28 │ 164.72 │
│   12    │ 'crura' │ 23 │ 162.23 │
│   13    │ 'copra' │ 29 │ 157.73 │
│   14    │ 'corah' │ 29 │ 156.9  │
└─────────┴─────────┴────┴────────┘
```

In the output you will get a sorted by highest score list of tuples [word, score, score].

Heuristics for English language are taken from [here](https://www3.nd.edu/~busiforc/handouts/cryptography/letterfrequencies.html).

For Bulgarian I am doing a simple count of how many times a letter repeats in the words list + using this one [frequency based on wikipedia articles](http://simia.net/letters/).
