import {Injectable, Project, DockerService, AppConfigService} from "@wocker/core";
import {demuxOutput, Http} from "@wocker/utils";
import {promptInput, promptConfirm} from "@wocker/prompts";
import * as Path from "path";
import {ReverseProxyProvider} from "../types/ReverseProxyProvider";
import {Config} from "../makes/Config";
import {
    LT_SUBDOMAIN_KEY,
    LT_AUTO_CONFIRM_KEY,
    SUBDOMAIN_KEY
} from "../env";


@Injectable()
export class LocalTunnelProvider implements ReverseProxyProvider {
    public get oldImages(): string[] {
        return [
            "ws-localtunnel:latest"
        ];
    }

    public get imageName(): string {
        return "ws-localtunnel:1.0.0";
    }

    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly dockerService: DockerService
    ) {}

    public async init(project: Project): Promise<void> {
        const subdomain = await promptInput({
            message: "Subdomain",
            prefix: "https://",
            suffix: ".loca.lt",
            default: project.getMeta(SUBDOMAIN_KEY) || project.getMeta(LT_SUBDOMAIN_KEY, project.name)
        });

        const autoConfirmIP = await promptConfirm({
            message: "Do you want to skip the IP confirmation form automatically?",
            default: this.appConfigService.getMeta(LT_AUTO_CONFIRM_KEY, "true") === "true" || project.getMeta(LT_AUTO_CONFIRM_KEY, "true") === "true"
        });

        this.appConfigService.setMeta(LT_AUTO_CONFIRM_KEY, autoConfirmIP ? "true" : "false");

        project.setMeta(SUBDOMAIN_KEY, subdomain);

        project.unsetMeta(LT_SUBDOMAIN_KEY);
        project.unsetMeta(LT_AUTO_CONFIRM_KEY);
    }

    public async start(config: Config, restart?: boolean, rebuild?: boolean): Promise<void> {
        if(restart || rebuild) {
            await this.stop(config);
        }

        await this.build(rebuild);

        let container = await this.dockerService.getContainer(config.containerName);

        if(!container) {
            container = await this.dockerService.createContainer({
                name: config.containerName,
                image: this.imageName,
                restart: "always",
                env: {
                    PORT: config.port,
                    HOST: config.name,
                    SUBDOMAIN: config.subdomain || ""
                }
            });
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

            await new Promise((resolve, reject) => {
                stream.on("data", (data: ArrayBuffer) => {
                    const line = data.toString();

                    if(line.includes("Tunnel started at")) {
                        stream.end();
                    }
                });

                stream.on("end", resolve);
                stream.on("error", reject);
            });
        }

        const link = await this.getUrl(config);
        const ip = await this.getIp();

        console.info(`Forwarding: ${link}`);
        console.info(`IP: ${ip}`);

        if(this.appConfigService.getMeta(LT_AUTO_CONFIRM_KEY, "false") === "true") {
            await this.confirm(link, ip);
        }
    }

    public async stop(config: Config): Promise<void> {
        await this.dockerService.removeContainer(config.containerName);
    }

    public async build(rebuild?: boolean): Promise<void> {
        await this.removeOldImages();

        if(await this.dockerService.imageExists(this.imageName)) {
            if(!rebuild) {
                return;
            }

            await this.dockerService.imageRm(this.imageName);
        }

        await this.dockerService.buildImage({
            tag: this.imageName,
            context: Path.join(__dirname, "../../provider/localtunnel"),
            src: "./Dockerfile",
            dockerfile: "./Dockerfile"
        });
    }

    public async removeOldImages(): Promise<void> {
        const images = await this.dockerService.imageLs({
            reference: this.oldImages
        });

        for(const image of images) {
            const {Id} = image;

            await this.dockerService.imageRm(Id, true);
        }
    }

    public async logs(config: Config): Promise<void> {
        const container = await this.dockerService.getContainer(config.containerName);

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
        const ip = await Http.base("https://ipv4.icanhazip.com")
            .expectStatus(200)
            .text();

        return ip.replace("\n", "");
    }

    public async confirm(link: string, ip: string): Promise<void> {
        console.info("Skipping IP confirmation...");

        const client = Http.base(link, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.149 Safari/537.36"
            }
        });

        const pageContent = await client.text();

        const [path] = /\/continue\/[\w.]+/.exec(pageContent) || [];

        if(path) {
            const res = await client
                .withFormUrlEncoded({
                    endpoint: ip
                })
                .post(path)
                .send();

            if(res.status === 200) {
                console.info("IP confirmed");
            }
        }
    }

    public async getUrl(config: Config): Promise<string> {
        const container = await this.dockerService.getContainer(config.containerName);

        if(!container) {
            return "";
        }

        const {
            State: {
                Running
            }
        } = await container.inspect();

        if(!Running) {
            return "";
        }

        try {
            const stream = await this.dockerService.exec(config.containerName, {
                cmd: ["cat", "/tmp/tunnel.json"]
            });

            if(!stream) {
                return "";
            }

            const data = await new Promise<string>((resolve, reject) => {
                let res = "";

                stream.on("data", (chunk) => {
                    res += demuxOutput(chunk).toString();
                });
                stream.on("end", () => resolve(res));
                stream.on("error", reject);
            });

            const {url} = JSON.parse(data.replace(/[^\x20-\x7E]/g, "").trim());

            return url || "";
        }
        catch(err) {
            return "";
        }
    }
}
