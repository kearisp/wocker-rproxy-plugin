import {Injectable, PluginConfigService, DockerService, Project} from "@wocker/core";
import {promptConfirm, promptInput} from "@wocker/utils";
import {ProxyProvider} from "../types/ProxyProvider";
import {NGROK_SUBDOMAIN_KEY, NGROK_TOKEN_KEY} from "../env";


@Injectable()
export class NgrokService implements ProxyProvider {
    public imageName = "ngrok/ngrok:latest";

    public constructor(
        protected readonly pluginConfigService: PluginConfigService,
        protected readonly dockerService: DockerService,
    ) {}

    public async getToken(project: Project): Promise<string> {
        const oldVersion = project.getMeta(NGROK_TOKEN_KEY, "") as string;

        if(!this.pluginConfigService.isVersionGTE("1.0.22")) {
            console.info("Please upgrade @wocker/ws to version 1.0.22 or higher to enable secure key storage using keystore (encrypted file or keytar)");

            return oldVersion;
        }

        return project.getSecret(NGROK_TOKEN_KEY, oldVersion);
    }

    public async setToken(project: Project, token: string): Promise<void> {
        if(!this.pluginConfigService.isVersionGTE("1.0.22")) {
            console.info("Please upgrade @wocker/ws to version 1.0.22 or higher to enable secure key storage using keystore (encrypted file or keytar)");

            project.setMeta(NGROK_TOKEN_KEY, token);
            project.save();
            return;
        }

        if(project.hasMeta(NGROK_TOKEN_KEY)) {
            project.unsetMeta(NGROK_TOKEN_KEY);
            project.save();
        }

        await project.setSecret(NGROK_TOKEN_KEY, token);
    }

    public async init(project: Project): Promise<void> {
        const token = await promptInput({
            message: "Auth token",
            required: true,
            type: "text",
            default: await this.getToken(project)
        });

        await this.setToken(project, token);

        const enableSubdomain = await promptConfirm({
            message: "Enable subdomain?",
            default: !!project.getMeta(NGROK_SUBDOMAIN_KEY)
        });

        if(enableSubdomain) {
            const subdomain = await promptInput({
                message: "Subdomain",
                prefix: "https://",
                suffix: ".ngrok-free.app",
                default: project.getMeta(NGROK_SUBDOMAIN_KEY, project.name)
            });

            project.setMeta(NGROK_SUBDOMAIN_KEY, subdomain);
        }
        else {
            project.unsetMeta(NGROK_SUBDOMAIN_KEY);
        }
    }

    public async start(project: Project, restart?: boolean): Promise<void> {
        if(restart) {
            await this.stop(project);
        }

        let container = await this.dockerService.getContainer(`ngrok-${project.name}`);

        if(!container) {
            await this.dockerService.pullImage(this.imageName);

            container = await this.dockerService.createContainer({
                name: `ngrok-${project.name}`,
                image: this.imageName,
                tty: true,
                restart: "always",
                env: {
                    NGROK_AUTHTOKEN: await this.getToken(project)
                },
                cmd: (() => {
                    const port = project.getEnv("VIRTUAL_PORT") || "80";
                    const cmd: string[] = ["http", `${project.containerName}:${port}`];

                    if(project.hasMeta(NGROK_SUBDOMAIN_KEY)) {
                        cmd.push(`--domain=${project.getMeta(NGROK_SUBDOMAIN_KEY)}.ngrok-free.app`);
                    }

                    return cmd;
                })()
            });

            const stream = await container.attach({
                logs: true,
                stream: true,
                hijack: true,
                stdin: true,
                stdout: true,
                stderr: true
            });

            stream.setEncoding("utf8");

            await container.start();

            await container.resize({
                w: process.stdout.columns,
                h: process.stdout.rows
            });

            await new Promise((resolve, reject) => {
                stream.on("data", (data: ArrayBuffer) => {
                    const regLink = /(https?):\/\/(\w[\w.-]+[a-z]|\d+\.\d+\.\d+\.\d+)(?::(\d+))?/;

                    if(regLink.test(data.toString())) {
                        const [link = ""] = regLink.exec(data.toString()) || [];

                        if(link.includes(".ngrok")) {
                            console.info(`Forwarding: ${link}`);

                            stream.end();
                        }
                    }
                });

                stream.on("end", resolve);
                stream.on("error", reject);
            });
        }
    }

    public async stop(project: Project): Promise<void> {
        await this.dockerService.removeContainer(`ngrok-${project.name}`);
    }

    public async build(rebuild?: boolean): Promise<void> {
        //
    }

    public async logs(project: Project): Promise<void> {
        await this.dockerService.logs(`ngrok-${project.name}`);
    }
}
