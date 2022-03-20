const readFileSync = require('fs').readFileSync;
const path = require('path');

const wordsFilePath = path.join(__dirname, "words", `bg.words.txt`);
const words = readFileSync(wordsFilePath, "utf8")
    .split("\n")
    .filter(x => x === x.toLocaleLowerCase())

words.sort((b, a) => a.length - b.length)

console.log(words, words[0], words[0].length)