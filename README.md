# wordle-solver

Find and rank English or Bulgarian words that match your Wordle clues. Both languages support five and six letters.

## Usage

Run `npm start` and open `http://localhost:5000` for the web form. To search from the command line, run

```sh
npm run solve -- en "sw?on"
npm run solve -- en "?????" has=l,o,r,d not=c,e,a,s,w
npm run solve -- en "????t" has=t,l,e not=c,a,r,s,o,i,n,f
npm run solve -- en "c????" has=a,r not=t,i "unknown=?a???,??a??"
```

The first search returns `swoon`. The second includes `drool` and `droll`. The third includes `veldt`.

- The pattern fixes letter positions. Each `?` matches one letter.
- `has` requires letters anywhere in the word. Repeat a letter for each confirmed copy. The solver uses the larger of its counts in `has` and in the pattern.
- `not` records gray letters. A gray letter has exactly the confirmed number of copies, which can be zero. For example, `has=p,a,s not=e,t,u,r,a` allows exactly one `a`.
- `unknown` lists forbidden positions. For example, `?a???,??a??` excludes `a` in the second and third positions.

## Dictionaries and rankings

Five-letter English searches include every five-letter A–Z entry in `words/en.words.txt`, including names and abbreviations. The solver lowercases and deduplicates entries and also includes the existing `words/words/english5.json` candidates. English six-letter searches and both Bulgarian word lengths use the corresponding JSON lists in `words/words/`.

The browser shows up to 15 words per ranking. Score 1 counts each distinct letter using its frequency among the remaining candidates. Score 2 uses language-wide letter weights. Score 3 counts every occurrence of a letter using the remaining candidates. Explicitly required letters contribute zero to scores 1 and 3. The CLI displays the first two rankings.

`POST /parse` accepts `lang`, `pattern`, `letters`, `ignore`, and `unknowns`. Each entry in `letters` represents one confirmed copy. Entries in `ignore` mark gray letters. A successful response contains `[total, ranking1, ranking2, ranking3]`. Each ranked row contains `[word, score1, score2, score3]`. Invalid clue formats return HTTP 422 with an `error` message. A valid search with no matches returns `[0, [], [], []]`.

Run `npm test` for the regression tests.

Heuristics for English language are taken from [here](https://www3.nd.edu/~busiforc/handouts/cryptography/letterfrequencies.html).

For Bulgarian I am doing a simple count of how many times a letter repeats in the words list + using this one [frequency based on wikipedia articles](http://simia.net/letters/).
