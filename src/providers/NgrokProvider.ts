import {
    Injectable,
    AppConfigService,
    DockerService,
    Project,
    ProjectService,
    PluginConfigService,
    KeystoreService
} from "@wocker/core";
import {demuxOutput} from "@wocker/utils";
import {promptConfirm, promptInput} from "@wocker/prompts";
import {ReverseProxyProvider} from "../types/ReverseProxyProvider";
import {Config} from "../makes/Config";
import {
    SUBDOMAIN_KEY,
    NGROK_SUBDOMAIN_KEY,
    NGROK_TOKEN_KEY,
    NGROK_BULK_KEY
} from "../env";


@Injectable()
export class NgrokProvider implements ReverseProxyProvider {
    public readonly containerName = "wocker-ngrok";
    public readonly imageName = "ngrok/ngrok:latest";

    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly projectService: ProjectService,
        protected readonly pluginConfigService: PluginConfigService,
        protected readonly dockerService: DockerService,
        protected readonly keystoreService: KeystoreService
    ) {}

    public get fs() {
        return this.pluginConfigService.fs;
    }

    public async getToken(): Promise<string> {
        return this.keystoreService.get(NGROK_TOKEN_KEY, "");
    }

    public async setToken(token: string): Promise<void> {
        if(!this.pluginConfigService.isVersionGTE("1.0.22")) {
            console.info("Please upgrade @wocker/ws to version 1.0.22 or higher to enable secure key storage using keystore (encrypted file or keytar)");

            this.appConfigService.setMeta(NGROK_TOKEN_KEY, token);
            return;
        }

        await this.keystoreService.set(NGROK_TOKEN_KEY, token);
    }

    public async init(project: Project): Promise<void> {
        const oldToken = project.getMeta(NGROK_TOKEN_KEY, "") as string;

        if(oldToken) {
            await this.keystoreService.set(NGROK_TOKEN_KEY, oldToken);
            project.unsetMeta(NGROK_TOKEN_KEY);
        }

        const secretToken = await project.getSecret(NGROK_TOKEN_KEY);

        if(secretToken) {
            await this.keystoreService.set(NGROK_TOKEN_KEY, secretToken);
            await project.unsetSecret(NGROK_TOKEN_KEY);
        }

        const token = await promptInput({
            message: "Auth token",
            required: true,
            type: "password",
            default: await this.getToken()
        });

        await this.setToken(token);

        const enableSubdomain = await promptConfirm({
            message: "Enable subdomain?",
            default: project.hasMeta(SUBDOMAIN_KEY) || project.hasMeta(NGROK_SUBDOMAIN_KEY)
        });

        if(enableSubdomain) {
            const subdomain = await promptInput({
                message: "Subdomain",
                prefix: "https://",
                suffix: ".ngrok-free.app",
                default: project.getMeta(SUBDOMAIN_KEY) || project.getMeta(NGROK_SUBDOMAIN_KEY, project.name)
            });

            project.setMeta(SUBDOMAIN_KEY, subdomain);
        }
        else {
            project.unsetMeta(SUBDOMAIN_KEY);
        }

        project.unsetMeta(NGROK_SUBDOMAIN_KEY);

        const isBulk = await promptConfirm({
            message: "Run in bulk mode?",
            default: this.appConfigService.getMeta(NGROK_BULK_KEY, "false") === "true"
        });

        this.appConfigService.setMeta(NGROK_BULK_KEY, isBulk ? "true" : "false");
    }

    public async start(config: Config, restart?: boolean): Promise<void> {
        const isBulk = this.appConfigService.getMeta(NGROK_BULK_KEY, "false") === "true";

        const container = isBulk
            ? await this.startBulkMode(config, restart)
            : await this.startSingleMode(config, restart);

        if(!container) {
            return;
        }

        const {
            State: {
                Running
            }
        } = await container.inspect();

        if(!Running) {
            const stream = await container.attach({
                logs: true,
                stream: true,
                hijack: true,
                stdin: true,
                stdout: true,
                stderr: true
            });

            await container.start();

            await Promise.all([
                container.resize({
                    w: process.stdout.columns,
                    h: process.stdout.rows
                }),
                new Promise((resolve, reject) => {
                    stream.on("data", (data: ArrayBuffer) => {
                        const regLink = /(https?):\/\/(\w[\w.-]+[a-z]|\d+\.\d+\.\d+\.\d+)(?::(\d+))?/;

                        if(regLink.test(data.toString())) {
                            const [link = ""] = regLink.exec(data.toString()) || [];

                            if(link.includes(".ngrok")) {
                                stream.end();
                            }
                        }
                    });

                    stream.on("end", resolve);
                    stream.on("error", reject);
                })
            ]);

            process.stdout.write("\n");
        }

        console.log(await this.getUrl(config));
    }

    protected async startSingleMode(config: Config, restart?: boolean) {
        const containers = await this.dockerService.listContainer({});
        const targetLabel = `wocker.rproxy.target.${config.name}:${config.port}`;

        // Alternative logic if listContainer could filter by label:
        // const containers = await this.dockerService.listContainer({
        //     label: [targetLabel]
        // });
        const existing = containers.find(c => {
            if(!c.Labels)
                return false;

            return Object.keys(c.Labels).some(key => key.startsWith(`wocker.rproxy.target.${config.name}:`));
        });

        if(existing) {
            const name = existing.Names[0].replace(/^\//, "");

            if(restart) {
                await this.dockerService.removeContainer(name);
            }
            else {
                return this.dockerService.getContainer(name);
            }
        }

        const labels: Record<string, string> = {
            [targetLabel]: config.subdomain || ""
        };

        return this.dockerService.createContainer({
            name: config.containerName,
            image: this.imageName,
            tty: true,
            restart: "always",
            env: {
                NGROK_AUTHTOKEN: await this.getToken()
            },
            labels,
            cmd: (() => {
                const cmd: string[] = ["http", `${config.name}:${config.port}`];

                if(config.subdomain) {
                    cmd.push(`--domain=${config.subdomain}.ngrok-free.app`);
                }

                return cmd;
            })()
        });
    }

    protected async startBulkMode(config: Config, restart?: boolean) {
        if(!this.pluginConfigService.isVersionGTE("1.0.29")) {
            throw new Error("Please upgrade @wocker/ws to version 1.0.29 or higher to use this plugin");
        }

        const containers = await this.dockerService.listContainer({});
        // Alternative logic if listContainer could filter by label:
        // const containers = await this.dockerService.listContainer({
        //     label: ["wocker.rproxy.bulk=true"]
        // });
        let containerInfo = containers.find(c => c.Labels && c.Labels["wocker.rproxy.bulk"] === "true");

        if(containerInfo && !restart) {
            if(containerInfo.Labels[`wocker.rproxy.target.${config.name}:${config.port}`] === (config.subdomain || "")) {
                const name = containerInfo.Names[0].replace(/^\//, "");
                return this.dockerService.getContainer(name);
            }
        }

        const targetLabel = `wocker.rproxy.target.${config.name}:${config.port}`;
        const targetValue = config.subdomain || "";

        const labels: Record<string, string> = containerInfo?.Labels || {
            "wocker.rproxy.bulk": "true"
        };

        // Remove old labels for this project name if they exist with different ports
        for(const key of Object.keys(labels)) {
            if(key.startsWith(`wocker.rproxy.target.${config.name}:`)) {
                delete labels[key];
            }
        }

        labels[targetLabel] = targetValue;

        if(containerInfo) {
            const name = containerInfo.Names[0].replace(/^\//, "");
            await this.dockerService.removeContainer(name);
        }

        await this.rebuildNgrokConfig(this.parseLabels(labels));

        return this.dockerService.createContainer({
            name: this.containerName,
            image: this.imageName,
            cmd: ["start", "--all", "--config", "/etc/ngrok/ngrok.yml"],
            env: {
                NGROK_AUTHTOKEN: await this.getToken()
            },
            labels,
            volumes: [
                `${this.fs.path("ngrok.yml")}:/etc/ngrok/ngrok.yml`
            ]
        });
    }

    protected parseLabels(labels: Record<string, string>): Config[] {
        const configs: Config[] = [];

        for(const [key, value] of Object.entries(labels)) {
            if(key.startsWith("wocker.rproxy.target.")) {
                const target = key.replace("wocker.rproxy.target.", "");
                const [name, port] = target.split(":");

                configs.push(new Config(
                    name,
                    port,
                    value || undefined
                ));
            }
        }

        return configs;
    }

    protected async rebuildNgrokConfig(configs: Config[]) {
        const tunnels: Record<string, any> = {};

        for(const config of configs) {
            tunnels[config.name] = {
                proto: "http",
                addr: `${config.name}:${config.port}`,
                schemes: ["https"]
            };

            if(config.subdomain) {
                tunnels[config.name].domain = `${config.subdomain}.ngrok-free.app`;
            }
        }

        this.fs.writeYAML("ngrok.yml", {
            version: 2,
            tunnels
        });
    }

    public async stop(config: Config): Promise<void> {
        const containers = await this.dockerService.listContainer({});
        const targetPrefix = `wocker.rproxy.target.${config.name}:`;

        // Alternative logic if listContainer could filter by label:
        // const containers = await this.dockerService.listContainer({
        //     label: [`wocker.rproxy.target.${config.name}`]
        // });
        const containerInfo = containers.find(c => {
            if (!c.Labels) return false;
            return Object.keys(c.Labels).some(key => key.startsWith(targetPrefix) || key === `wocker.rproxy.target.${config.name}`);
        });

        if(!containerInfo) {
            // fallback for old versions or cases where label is missing
            await this.dockerService.removeContainer(`ngrok-${config.name}`);
            return;
        }

        if(containerInfo.Labels["wocker.rproxy.bulk"] === "true") {
            const labels = {...containerInfo.Labels};
            for (const key of Object.keys(labels)) {
                if (key.startsWith(targetPrefix) || key === `wocker.rproxy.target.${config.name}`) {
                    delete labels[key];
                }
            }

            const name = containerInfo.Names[0].replace(/^\//, "");
            await this.dockerService.removeContainer(name);

            const configs = this.parseLabels(labels);

            if(configs.length > 0) {
                await this.rebuildNgrokConfig(configs);

                const container = await this.dockerService.createContainer({
                    name: this.containerName,
                    image: this.imageName,
                    cmd: ["start", "--all", "--config", "/etc/ngrok/ngrok.yml"],
                    env: {
                        NGROK_AUTHTOKEN: await this.getToken()
                    },
                    labels,
                    volumes: [
                        `${this.fs.path("ngrok.yml")}:/etc/ngrok/ngrok.yml`
                    ]
                });

                await container.start();
            }
        }
        else {
            const name = containerInfo.Names[0].replace(/^\//, "");

            await this.dockerService.removeContainer(name);
        }
    }

    public async build(_rebuild?: boolean): Promise<void> {
        //
    }

    public async logs(config: Config): Promise<void> {
        const isBulk = this.appConfigService.getMeta(NGROK_BULK_KEY, "false") === "true";

        const apiHost = isBulk
            ? this.containerName
            : config.containerName;

        const container = await this.dockerService.getContainer(apiHost);

        if(!container) {
            return;
        }

        const stream = await container.attach({
            logs: true,
            stream: true,
            hijack: true,
            stdin: true,
            stdout: true,
            stderr: true,
            detachKeys: "ctrl-c"
        });

        await container.resize({
            w: process.stdout.columns - 1,
            h: process.stdout.rows
        });

        await Promise.all([
            container.resize({
                w: process.stdout.columns,
                h: process.stdout.rows
            }),
            this.dockerService.attachStream(stream)
        ]);
    }

    public async getUrl(config: Config) {
        if(!this.pluginConfigService.isVersionGTE("1.0.29")) {
            throw new Error("Wocker update required");
        }

        const isBulk = this.appConfigService.getMeta(NGROK_BULK_KEY, "false") === "true";

        const apiHost = isBulk
            ? this.containerName
            : config.containerName;

        const container = await this.dockerService.getContainer(apiHost);

        if(!container) {
            throw new Error("Container is not started");
        }

        const buffer = await this.dockerService.exec("wocker-proxy", ["curl", "-s", `http://${apiHost}:4040/api/tunnels`]);

        if(!buffer) {
            return;
        }

        const res = await new Promise<string>((resolve, reject) => {
            let res: string = "";

            buffer.on("data", (chunk) => {
                res += demuxOutput(chunk).toString();
            });
            buffer.on("error", reject);
            buffer.on("end", () => {
                resolve(res);
            });
        });

        const {
            tunnels
        } = JSON.parse(res);

        const tunnel = tunnels.find((tunnel: any) => {
            return tunnel.config.addr === `http://${config.name}:${config.port}`;
        });

        if(!tunnel) {
            throw new Error("Tunnel not found");
        }

        return tunnel.public_url;
    }
}
