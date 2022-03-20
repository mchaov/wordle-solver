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

function renderInputTextPattern(langs, lang, numberOfLetters, pattern) {
    if (lang === "") { return "" }

    return `
        <input 
            id="pattern"
            type="text"
            required
            pattern="${langs[lang].validPattern}{${numberOfLetters}}"
            placeholder="${"?".repeat(numberOfLetters)}"
            value=${pattern}>
    `
}

function renderLanguageSelect(langs, lang) {
    return `
    <select id="lang">
        ${Object.keys(langs).map(x => `<option ${x === lang ? "selected" : ""} value="${x}">${x.toLocaleUpperCase()}</option>`).join("")}
    </select>
    `
}

function renderKnownLetters(langs, lang, knownLetters, numberOfLetters) {
    if (lang === "") { return "" }

    const letters = [...new Set(knownLetters.split(""))].join("")

    return `
        Known letters: <input
            id="knownLetters" 
            type="text"
            pattern="${langs[lang].validPattern}{${numberOfLetters}}"
            value="${letters}">
    `;
}

function renderInvalidLetters(langs, lang, invalidLetters, numberOfLetters) {
    if (lang === "") { return "" }

    const letters = [...new Set(invalidLetters.split(""))].join("")

    return `
        Invalid letters: <input
            id="invalidLetters" 
            type="text"
            pattern="${langs[lang].validPattern}{${numberOfLetters}}"
            value="${letters}">
    `;
}

function renderUnknownPatterns(lang, unknownPatterns) {
    if (lang === "") { return "" }

    return `
        Unknown places: <input
            id="unknownPatterns" 
            type="text"
            value="${unknownPatterns}">
    `;
}

function renderSubmit(lang) {
    if (lang === "") { return "" }

    return `
        <button id="query" type="button">Find</button>
    `
}

function renderReset(lang) {
    if (lang === "") { return "" }

    return `
        <button id="reset" type="button">Reset</button>
    `
}

function renderTable(set, cls1, cls2) {
    if (!set) { return "" }

    const markup = `
    <table class="tbl">
        <thead>
            <tr>
                <th>Word</th>
                <th class="${cls1}">Score 1</th>
                <th class="${cls2}">Score 2</th>
            </tr>
        </thead>
        <tbody>
            ${set.map(([word, s1, s2]) => `<tr>
                <td>${word}</td>
                <td class="${cls1}">${s1}</td>
                <td class="${cls2}">${s2}</td>
            </tr>`).join("")}
        </tbody>
    </table>
    `;

    return markup
}

function renderResult(lang, result) {
    if (lang === "" || result.length === 0) { return "" }

    const [total, set1, set2] = result

    return `
    <h3>Found:</h3>
    <h4>Total words: ${total}</h4>

    ${renderTable(set1, "red", "")}
    ${renderTable(set2, "", "red")}
    `
}

const initialState = {
    pattern: "",
    lang: "en",
    numberOfLetters: 5,
    knownLetters: "",
    invalidLetters: "",
    unknownPatterns: "",
    result: []
}

let state = { ...initialState }

if (localStorage.getItem("state")) {

    let oldState = {}
    try {
        oldState = JSON.parse(localStorage.getItem("state"))
    } catch (e) { }

    state = { ...initialState, ...oldState }
}

// html5 form validity
// https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/reportValidity
// uses the pattern field to report if all input match what is expected

function renderMarkup({ lang, numberOfLetters, knownLetters, invalidLetters, unknownPatterns, result, pattern }) {
    const markup = `
    <form id="wordConfig">
        ${renderLanguageSelect(langs, lang)}
        ${renderInputNumberOfLetters(langs, lang, numberOfLetters)}
        ${renderInputTextPattern(langs, lang, numberOfLetters, pattern)}
        <hr/>
        ${renderKnownLetters(langs, lang, knownLetters, numberOfLetters)}
        <hr/>
        ${renderInvalidLetters(langs, lang, invalidLetters, numberOfLetters)}
        <hr/>
        ${renderUnknownPatterns(lang, unknownPatterns)}
        <hr/>
        ${renderReset(lang)}
        ${renderSubmit(lang)}
        <hr/>
        <div class="tables">
            ${renderResult(lang, result)}
        </div>
    </form>
    `;

    return markup
}

function changeHandler({ target }) {

    if (target.id === "lang") {
        state = { ...initialState }
    }

    state[target.id] = target.value

    localStorage.setItem("state", JSON.stringify(state))

    renderDOM(state)
}

function clickHandler({ target }) {

    if (target.id === "query") {
        const { lang, knownLetters, invalidLetters, unknownPatterns, pattern, numberOfLetters } = state

        fetch("/parse", {
            method: "POST",
            body: JSON.stringify({
                lang: lang,
                pattern: pattern === "" ? "?".repeat(numberOfLetters) : pattern,
                letters: knownLetters.length === 0 ? [] : knownLetters.split(""),
                ignore: invalidLetters.length === 0 ? [] : invalidLetters.split(""),
                unknowns: unknownPatterns.length === 0 ? [] : unknownPatterns.split(",")
            })
        })
            .then(x => x.json())
            .then(result => {
                state = { ...state, result }
                localStorage.setItem("state", JSON.stringify(state))
                renderDOM(state)
            })
    }

    if (target.id === "reset") {
        state = { ...initialState }
        localStorage.setItem("state", JSON.stringify(state))
        renderDOM(state)
    }

}

function renderDOM(state) {
    const domApp = document.getElementById("app")
    domApp.innerHTML = renderMarkup(state);
}

function main() {
    renderDOM(state)

    document.addEventListener("change", changeHandler)
    document.addEventListener("click", clickHandler)
}

window.addEventListener("load", main);