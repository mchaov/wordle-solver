const { spawn } = require("node:child_process")
const { once } = require("node:events")
const path = require("node:path")
const { createInterface } = require("node:readline")

module.exports = async function startServer(t) {
    const child = spawn(process.execPath, [path.join(__dirname, "../server.js")], {
        env: { ...process.env, PORT: "0" },
        stdio: ["ignore", "pipe", "inherit"],
        windowsHide: true
    })
    const exited = once(child, "exit")
    t.after(async () => {
        if (child.exitCode === null) child.kill()
        await exited
    })
    const lines = createInterface({ input: child.stdout })
    const [line] = await Promise.race([
        once(lines, "line"),
        exited.then(([code]) => { throw new Error("Server exited during startup with code " + code) })
    ])
    const [, port] = line.match(/^Server listening at port (\d+)$/)
    return "http://127.0.0.1:" + port
}
