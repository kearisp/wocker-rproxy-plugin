const localtunnel = require("localtunnel");
const fs = require("fs");


const host = process.env.HOST || "localhost";
const port = parseInt(process.env.PORT || "80", 10);
const subdomain = process.env.SUBDOMAIN || undefined;
const infoPath = process.env.INFO_PATH || "/tmp/tunnel.json";


(async () => {
    try {
        const tunnel = await localtunnel({
            local_host: host,
            port,
            subdomain
        });

        const info = {
            url: tunnel.url,
            port,
            host,
            subdomain
        };

        fs.writeFileSync(infoPath, JSON.stringify(info));
        console.log(`Tunnel started at ${tunnel.url}`);

        tunnel.on("request", info => {
            console.log(new Date().toString(), info.method, info.path);
        });

        tunnel.on("close", () => {
            console.log("Tunnel closed");

            if(fs.existsSync(infoPath)) {
                fs.unlinkSync(infoPath);
            }

            process.exit(0);
        });

        process.on("SIGINT", () => {
            tunnel.close();
        });

        process.on("SIGTERM", () => {
            tunnel.close();
        });
    }
    catch(err) {
        console.error("Error starting tunnel:", err);
        process.exit(1);
    }
})();
