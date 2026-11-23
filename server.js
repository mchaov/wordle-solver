const readFileSync = require("fs").readFileSync;
const path = require("path");
const solve = require("./solver.js")

const staticDir = path.resolve(__dirname, "static");
const js = readFileSync(path.join(staticDir, "app.js")).toString();
const cluesModule = readFileSync(path.join(staticDir, "clues.mjs")).toString();
const css = readFileSync(path.join(staticDir, "app.css")).toString();
const index = readFileSync(path.resolve(__dirname, "index.html")).toString();

function parse(req, res, headers) {
    function send(status, payload) {
        res.writeHead(status, { ...headers, "Content-Type": "application/json; charset=utf-8" })
        res.end(JSON.stringify(payload))
    }
    let data = "";
    req.setEncoding("utf8")
    req
        .on("error", console.error)
        .on("data", chunk => { data += chunk })
        .on("end", () => {
            res.on("error", console.error)

            let input
            try {
                input = JSON.parse(data)
            } catch {
                return send(400, { error: "Send the clues as a JSON object." })
            }
            if (!input || typeof input !== "object" || Array.isArray(input)) {
                return send(400, { error: "Send the clues as a JSON object." })
            }
            try {
                const { lang = "en", pattern = "?????", letters, ignore, unknowns } = input
                return send(200, solve(lang, pattern, letters, ignore, unknowns))
            } catch (e) {
                if (e instanceof solve.ClueError) return send(422, { error: e.message })
                console.error(e)
                return send(500, { error: "The word search could not be completed." })
            }
        })
}

function requestListener(req, res) {
    const { headers, method, url } = req

    const _headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS, GET, POST",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": 2592000, // 30 days
    };

    if (req.method === "OPTIONS") {
        res.writeHead(204, _headers);
        res.end();
        return;
    }

    if (url.match(/parse/) && req.method === "POST") {
        return parse(req, res, _headers)
    }

    if (url.match(/app\.css/)) {
        res.writeHead(200, {
            ..._headers,
            "Content-Type": "text/css"
        });
        res.statusCode = 200
        res.write(css)
        res.end()
        return;
    }

    const servesClues = url.split("?")[0] === "/static/clues.mjs"
    if (servesClues || url.match(/app\.js/)) {
        res.writeHead(200, {
            ..._headers,
            "Content-Type": "application/javascript"
        });
        res.statusCode = 200
        res.write(servesClues ? cluesModule : js)
        res.end()
        return;
    }

    res.writeHead(200, {
        ..._headers,
        "Content-Type": "text/html; charset=UTF-8"
    });
    res.statusCode = 200

    res.write(index)
    res.end()
}

const server = require("http").createServer(requestListener)
const port = process.env.PORT || 5000

server.listen(port, () => {
    console.log("Server listening at port %d", server.address().port)
})

server.on("error", (e) => {
    if (e.code === "EADDRINUSE") {
        console.log("Address in use, retrying...")
        setTimeout(() => {
            server.close()
            server.listen(port, HOST)
        }, 1000)
    }
})
