import {Injectable, Project, DockerService, LogService} from "@wocker/core";
import {promptText, promptConfirm} from "@wocker/utils";
import axios from "axios";
import * as Path from "path";

import {
    LOCALTUNNEL_SUBDOMAIN_KEY,
    LOCALTUNNEL_AUTO_CONFIRM_KEY
} from "../env";


@Injectable()
export class LocalTunnelService {
    protected readonly imageName = "ws-localtunnel";

    public constructor(
        protected readonly dockerService: DockerService,
        protected readonly logService: LogService
    ) {}

    public async init(project: Project): Promise<void> {
        const subdomain = await promptText({
            message: "Subdomain: ",
            prefix: "https://",
            suffix: ".loca.lt",
            default: project.getMeta(LOCALTUNNEL_SUBDOMAIN_KEY, project.name)
        });

        const autoConfirmIP = await promptConfirm({
            message: "Do you want to skip the IP confirmation form automatically?",
            default: project.getEnv(LOCALTUNNEL_AUTO_CONFIRM_KEY, "true") === "true"
        });

        project.setMeta(LOCALTUNNEL_AUTO_CONFIRM_KEY, autoConfirmIP ? "true" : "false");
        project.setMeta(LOCALTUNNEL_SUBDOMAIN_KEY, subdomain);
    }

    public async start(project: Project, restart?: boolean): Promise<void> {
        if(restart) {
            await this.stop(project);
        }

        let container = await this.dockerService.getContainer(`localtunnel-${project.name}`);

        if(!container) {
            await this.build(project);

            const subdomain = project.getMeta(LOCALTUNNEL_SUBDOMAIN_KEY, project.name);

            container = await this.dockerService.createContainer({
                name: `localtunnel-${project.name}`,
                image: this.imageName,
                restart: "always",
                networkMode: "host",
                cmd: [
                    "lt",
                    "--port=80",
                    `--local-host=${project.containerName}`,
                    `--subdomain=${subdomain}`,
                    "--print-requests"
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

                stream.on("data", (data) => {
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

            if(project.getMeta(LOCALTUNNEL_AUTO_CONFIRM_KEY, "false" as string) === "true") {
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

    public async build(project: Project, rebuild: boolean = false): Promise<void> {
        if(await this.dockerService.imageExists(this.imageName)) {
            if(!rebuild) {
                return;
            }

            await this.stop(project);
            await this.dockerService.imageRm(this.imageName);
        }

        await this.dockerService.buildImage({
            tag: this.imageName,
            context: Path.join(__dirname, "../../plugin/localtunnel"),
            src: "./Dockerfile"
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

        stream.on("data", (data) => {
            process.stdout.write(data);
        });

        stream.on("error", (data) => {
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
