// fetch("http://localhost:5000/parse", {
//     method: "POST",
//     body: JSON.stringify({
//         lang: "bg",
//         pattern: "пре?а",
//         letters: ["е", "а", "п", "р"],
//         ignore: ["о", "к", "н", "с"],
//         unknowns: ["???а?"]
//     })
// })
// .then(x => x.json())
// .then(console.log)

const langs = {
    en: {
        min: 3,
        max: 45,
        default: 5,
        validPattern: "[a-z]"
    },
    bg: {
        min: 3,
        max: 39,
        default: 5,
        validPattern: "[а-я]"
    }
}

function renderInputNumberOfLetters(langs, lang, numberOfLetters = 0) {
    if (lang === "") { return "" }

    return `
        <input 
            id="numberOfLetters" 
            type="number" 
            min="${langs[lang].min}" 
            max="${langs[lang].max}" 
            value="${numberOfLetters || langs[lang].default}">
    `
}

function renderInputTextPattern(lang, numberOfLetters) {
    if (lang === "") { return "" }

    return `
        <input 
            id="pattern"
            type="text"
            required
            pattern="${langs[lang].validPattern}{${numberOfLetters}}"
            placeholder="${"?".repeat(numberOfLetters)}">
    `
}

function renderLanguageSelect(langs, lang) {
    return `
    <select id="lang">
        <option value="-1">Choose language:</option>
        ${Object.keys(langs).map(x => `<option ${x === lang ? "selected" : ""} value="${x}">${x.toLocaleUpperCase()}</option>`).join("")}
    </select>
    `
}

let state = {
    lang: "",
    numberOfLetters: 5
}

// html5 form validity
// https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/reportValidity
// uses the pattern field to report if all input match what is expected

function renderMarkup({ lang, numberOfLetters }) {
    const markup = `
    <form id="wordConfig">
        ${renderLanguageSelect(langs, lang)}
        ${renderInputNumberOfLetters(langs, lang, numberOfLetters)}
        ${renderInputTextPattern(lang, numberOfLetters)}
    </form>
    `;

    return markup
}

function changeHandler({ target }) {

    if (target.id === "pattern") { return }

    state[target.id] = target.value

    renderDOM(state)
}

function renderDOM(state) {
    const domApp = document.getElementById("app")
    domApp.innerHTML = renderMarkup(state);
}

function main() {
    renderDOM(state)

    document.addEventListener("change", changeHandler)
}

window.addEventListener("load", main);