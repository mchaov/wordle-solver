const readFileSync = require("fs").readFileSync;
const path = require("path");
const solve = require("./solver.js")

const staticDir = path.resolve(__dirname, "static");
const js = readFileSync(path.join(staticDir, "app.js")).toString();
const css = readFileSync(path.join(staticDir, "app.css")).toString();
const index = readFileSync(path.resolve(__dirname, "index.html")).toString();

function parse(req, res) {

    let data = "";
    req
        .on("error", console.error)
        .on("data", chunk => { data += chunk })
        .on("end", () => {
            res.on("error", console.error)

            let input = {}
            try {
                input = JSON.parse(data)
            } catch (e) {
                console.warn(e)
            }

            let result = []
            try {
                result = solve(
                    input.lang || "en",
                    input.pattern || "?????",
                    input.letters || [],
                    input.ignore || [],
                    input.unknowns || []
                )
            } catch (e) {
                console.warn(input, e)
            }

            res.write(JSON.stringify(result))

            res.end()
        })
}

function requestListener(req, res) {
    const { headers, method, url } = req

    const _headers = {
        // "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS, GET, POST",
        "Access-Control-Max-Age": 2592000, // 30 days
    };

    if (req.method === "OPTIONS") {
        res.writeHead(204, _headers);
        res.end();
        return;
    }

    if (url.match(/parse/) && req.method === "POST") {
        res.writeHead(200, {
            ..._headers,
            "Content-Type": "application/json"
        });
        res.statusCode = 200
        return parse(req, res)
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

    if (url.match(/app\.js/)) {
        res.writeHead(200, {
            ..._headers,
            "Content-Type": "application/javascript"
        });
        res.statusCode = 200
        res.write(js)
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
    console.log("Server listening at port %d", port)
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