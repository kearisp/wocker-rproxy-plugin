import {Injectable, DockerService, Project} from "@wocker/core";
import {promptConfirm, promptText} from "@wocker/utils";

import {ProxyProvider} from "../types/ProxyProvider";
import {NGROK_SUBDOMAIN_KEY, NGROK_TOKEN_KEY} from "../env";


@Injectable()
export class NgrokService implements ProxyProvider {
    public constructor(
        protected readonly dockerService: DockerService
    ) {}

    public imageName = "ngrok/ngrok:latest";

    public async init(project: Project): Promise<void> {
        const token = await promptText({
            message: "Auth token:",
            default: project.getMeta(NGROK_TOKEN_KEY, "")
        });

        project.setMeta(NGROK_TOKEN_KEY, token);

        const enableSubdomain = await promptConfirm({
            message: "Enable subdomain?",
            default: !!project.getMeta(NGROK_SUBDOMAIN_KEY)
        });

        if(enableSubdomain) {
            const subdomain = await promptText({
                message: "Subdomain: ",
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

        let container = await this.dockerService.getContainer(`ngrok-${project.id}`);

        if(!container) {
            await this.dockerService.pullImage(this.imageName);

            container = await this.dockerService.createContainer({
                name: `ngrok-${project.id}`,
                image: this.imageName,
                tty: true,
                restart: "always",
                env: {
                    NGROK_AUTHTOKEN: project.getMeta(NGROK_TOKEN_KEY)
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
        await this.dockerService.removeContainer(`ngrok-${project.id}`);
    }

    public async build(rebuild?: boolean): Promise<void> {
        //
    }

    public async logs(project: Project): Promise<void> {
        await this.dockerService.logs(`ngrok-${project.id}`);
    }
}
