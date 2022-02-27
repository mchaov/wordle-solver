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

[
  "Cedar",
  "ceral",
  "Ceram",
  "ceras",
  "Cesar",
  "Chera",
  "Chora",
  "Chura",
  "cymar",
  "Cynar",
  "clear",
  "Cobra",
  "copra",
  "corah",
  "Coray",
  "Coral",
  "Coram",
  "coran",
  "Corea",
  "coroa",
  "crcao",
  "cread",
  "creak",
  "cream",
  "Crean",
  "creda",
  "crena",
  "Cresa",
  "cryal",
  "Cryan",
  "croak",
  "crosa",
  "CRSAB",
  "crura",
  "Cumar",
  "Cursa",
  "curua"
] total: 37
```
