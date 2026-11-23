# wordle-solver

Find and rank English or Bulgarian words that match your Wordle clues. Both languages support five and six letters.

## Usage

Run `npm start` and open `http://localhost:5000` for the Guess Board. Type or paste the word you played and mark its tiles to match the game's feedback.

- Left-click a tile for a letter in place (green). Right-click for a letter elsewhere in the word (yellow). Leave absent letters gray. To undo a mark, select the tile and use **Clear mark**.
- On a touchscreen, tap a tile and choose **In place**, **Elsewhere**, or **Clear mark**. With a keyboard, tab to the tiles, use the arrow keys to select one, and press **G**, **Y**, or **Delete**.
- Choose **Apply feedback** to search with all applied guesses. A gray copy alongside a green or yellow copy in the same guess limits that letter to the confirmed count. Edit or remove earlier guesses to update the search.
- Choose a suggestion to fill your next guess with the letters you’ve already marked. Confirmed positions carry over in green. Other confirmed copies start yellow. After playing the word, adjust any colors that changed and choose **Apply feedback**.
- **Advanced clues** lets you enter a pattern, letter counts, or impossible positions by hand. Choose **Apply clues** to combine those fields with the board.

The browser remembers your applied guesses, draft and advanced clues separately for each language and word length. **New puzzle** clears the current board.

To search from the command line, run

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

## Dictionaries

English searches use 8,584 five-letter words and 14,822 six-letter words. The board, API and CLI all read `english5.json` and `english6.json` in `words/words/`. The older `words/en.words.txt` is an archival collection. Both Bulgarian word lengths use the curated Bulgarian lists in `words/words/`.

The English source is the American edition of the English Speller Database (SCOWL). Entries must be standalone words spelled with lowercase a–z in the source. The filter excludes proper-name-only entries, abbreviations, word fragments and spellings marked nonstandard. A name such as Robin still qualifies through the ordinary noun `robin`. [SCOWL release and selection criteria](https://github.com/en-wl/wordlist/blob/7e99edab8e32f9f9ea2b15f249ca8d4d67237410/README.md)

The import includes standard U.S. entries through size 60 and American spelling variants through level 6, which admits `veldt`. For the wider word-game vocabulary through size 80 and the computing vocabulary, it also requires the exact spelling in Wordnik’s game dictionary. That keeps newer standard entries such as `emoji` and gives uncommon suggestions a second dictionary check. [Wordnik word list](https://github.com/wordnik/wordlist/tree/46e6215d0f90356afe9c8ba4be347e7e98cb425c) · [Dictionary license notices](words/ENGLISH-LICENSES.txt)

### Rebuild or verify the English lists

Use SCOWL release `rel-2026.02.25` and Wordnik’s `wordlist-20210729.txt` from the revisions linked above. In the SCOWL checkout, run `python -X utf8 combine.py create-db scowl.db`. From this repository run the following command with the paths to those files.

```sh
python scripts/build_english_words.py /path/to/scowl.db /path/to/wordlist-20210729.txt --check
```

Omit `--check` to regenerate both lists. The solver reads the generated files offline.

## Rankings

The board shows the full match count and three scores beside each suggestion. Select a score heading to see that rule’s top 15, highest first. Coverage is the default. A bold value means the word appears in that column’s top 15, so you can see where the rules agree. Choosing a word fills the next guess.

| Score | What earns points |
| --- | --- |
| Coverage (1) | Each distinct letter earns its frequency across the remaining matches once. |
| Language (2) | Each letter earns its language-wide frequency weight, including repeated copies. |
| All letters (3) | Each copy of a letter earns its frequency across the remaining matches. |

Explicitly required letters contribute zero to Coverage and All letters. Compare words within each column, since each rule has its own scale. The CLI displays the first two rankings.

## Public API

`POST /parse` accepts `lang`, `pattern`, `letters`, `ignore`, and `unknowns`. Each entry in `letters` represents one confirmed copy. Entries in `ignore` mark gray letters. A successful response contains `[total, ranking1, ranking2, ranking3]`. Each ranked row contains `[word, score1, score2, score3]`. Invalid clue formats return HTTP 422 with an `error` message. A valid search with no matches returns `[0, [], [], []]`.

For example, the feedback from `ACRID` (yellow R) and `ROVER` (green O, V, E and final R) gives three matches, `LOVER`, `MOVER` and `HOVER`. All other tiles in those two guesses are gray.

```js
const response = await fetch("/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
        lang: "en", pattern: "?over", letters: ["o", "v", "e", "r"],
        ignore: ["a", "c", "i", "d", "r"], unknowns: ["??r??", "r????"]
    })
})
const [total, byCoverage, byLanguage, byAllLetters] = await response.json()
```

## Tests

Run `npm test` for the clue, dictionary, API and CLI regressions. For the browser tests, run `npm ci`, `npx playwright install chromium` and `npm run test:browser`. The browser suite starts a local server on an available port.

## Letter frequencies

Heuristics for English language are taken from [here](https://www3.nd.edu/~busiforc/handouts/cryptography/letterfrequencies.html).

For Bulgarian I am doing a simple count of how many times a letter repeats in the words list + using this one [frequency based on wikipedia articles](http://simia.net/letters/).
