import {Injectable, Project, DockerService} from "@wocker/core";
import {promptInput, promptConfirm} from "@wocker/utils";
import axios from "axios";
import * as Path from "path";
import {ProxyProvider} from "../types/ProxyProvider";
import {
    LT_SUBDOMAIN_KEY,
    LT_AUTO_CONFIRM_KEY
} from "../env";


@Injectable()
export class LocalTunnelService implements ProxyProvider {
    protected readonly imageName = "ws-localtunnel";

    public constructor(
        protected readonly dockerService: DockerService
    ) {}

    public async init(project: Project): Promise<void> {
        const subdomain = await promptInput({
            message: "Subdomain",
            prefix: "https://",
            suffix: ".loca.lt",
            default: project.getMeta(LT_SUBDOMAIN_KEY, project.name)
        });

        const autoConfirmIP = await promptConfirm({
            message: "Do you want to skip the IP confirmation form automatically?",
            default: project.getEnv(LT_AUTO_CONFIRM_KEY, "true") === "true"
        });

        project.setMeta(LT_AUTO_CONFIRM_KEY, autoConfirmIP ? "true" : "false");
        project.setMeta(LT_SUBDOMAIN_KEY, subdomain);
    }

    public async start(project: Project, restart?: boolean, rebuild?: boolean): Promise<void> {
        let container = await this.dockerService.getContainer(`localtunnel-${project.name}`);

        if(container && (restart || rebuild)) {
            await this.stop(project);

            container = null;
        }

        if(!container) {
            await this.build(rebuild);

            const subdomain = project.getMeta(LT_SUBDOMAIN_KEY, project.name);

            const containerPort = project.getEnv("VIRTUAL_PORT", "80");
            const host = project.domains[0] || project.containerName;

            container = await this.dockerService.createContainer({
                name: `localtunnel-${project.name}`,
                image: this.imageName,
                restart: "always",
                cmd: [
                    "bash",
                    "-i",
                    "-c",
                    [
                        "lt",
                        `--port=${containerPort}`,
                        `--local-host=${host}`,
                        `--subdomain=${subdomain}`,
                        "--print-requests"
                    ].join(" ")
                ]
            });

            const stream = await container.attach({
                logs: true,
                stream: true,
                hijack: true,
                stdin: true,
                stderr: true,
                stdout: true
            });

            stream.setEncoding("utf8");

            await container.start();

            const link: string = await new Promise((resolve, reject) => {
                let res = "";

                stream.on("data", (data: any) => {
                    const regLink = /(https?):\/\/(\w[\w.-]+[a-z]|\d+\.\d+\.\d+\.\d+)(?::(\d+))?/;

                    if(regLink.test(data.toString())) {
                        const [link = ""] = regLink.exec(data.toString()) || [];

                        if(link.includes(".loca.lt")) {
                            res = link;

                            stream.end();
                        }
                    }
                });

                stream.on("end", () => resolve(res));
                stream.on("error", reject);
            });

            const ip = await this.getIp();

            console.info(`Forwarding: ${link}`);
            console.info(`IP: ${ip}`);

            if(project.getMeta(LT_AUTO_CONFIRM_KEY, "false" as string) === "true") {
                await this.confirm(link, ip);
            }
        }

        const {
            State: {
                Running
            }
        } = await container.inspect();

        if(!Running) {
            await container.start();
        }
    }

    public async stop(project: Project): Promise<void> {
        await this.dockerService.removeContainer(`localtunnel-${project.name}`);
    }

    public async build(rebuild?: boolean): Promise<void> {
        if(await this.dockerService.imageExists(this.imageName)) {
            if(!rebuild) {
                return;
            }

            await this.dockerService.imageRm(this.imageName);
        }

        await this.dockerService.buildImage({
            tag: this.imageName,
            context: Path.join(__dirname, "../../plugin/localtunnel"),
            src: "./Dockerfile",
            dockerfile: "./Dockerfile"
        });
    }

    public async logs(project: Project): Promise<void> {
        const container = await this.dockerService.getContainer(`localtunnel-${project.name}`);

        if(!container) {
            return;
        }

        const stream = await container.logs({
            follow: true,
            stderr: true,
            stdout: true,
            tail: 5
        });

        stream.on("data", (data: any) => {
            process.stdout.write(data);
        });

        stream.on("error", (data: any) => {
            process.stderr.write(data);
        });
    }

    public async getIp(): Promise<string> {
        const res = await axios.get("https://ipv4.icanhazip.com");

        return (res.data as string).replace("\n", "");
    }

    public async confirm(link: string, ip: string): Promise<void> {
        console.info("Skipping IP confirmation...");

        const res = await axios.get(link, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.149 Safari/537.36"
            },
            validateStatus: () => true
        });

        const [path] = /\/continue\/[\w.]+/.exec(res.data) || [];

        if(path) {
            const sendData = new URLSearchParams({
                endpoint: ip
            });

            const res = await axios.post(`${link}${path}`, sendData.toString(), {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.149 Safari/537.36",
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
                }
            });

            if(res.status === 200) {
                console.info("IP confirmed");
            }
        }
    }
}
