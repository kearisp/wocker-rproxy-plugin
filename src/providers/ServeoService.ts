import {
    Injectable,
    Project,
    AppConfigService,
    DockerService,
    PluginConfigService
} from "@wocker/core";
import {promptText} from "@wocker/utils";
import * as Path from "path";

import {ProxyProvider} from "../types/ProxyProvider";
import {SERVEO_SUBDOMAIN_KEY} from "../env";


@Injectable()
export class ServeoService implements ProxyProvider {
    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly pluginConfigService: PluginConfigService,
        protected readonly dockerService: DockerService
    ) {}

    get oldImages(): string[] {
        return [
            "wocker-serveo:latest",
            "wocker-serveo:2.0.0"
        ];
    }

    get imageName(): string {
        return "wocker-serveo:2.0.1";
    }

    get user(): string {
        return "ubuntu";
    }

    public async init(project: Project): Promise<void> {
        const subdomain = await promptText({
            message: "Subdomain: ",
            prefix: "https://",
            suffix: ".serveo.net",
            default: project.getMeta(SERVEO_SUBDOMAIN_KEY, project.name)
        });

        project.setMeta(SERVEO_SUBDOMAIN_KEY, subdomain);
    }

    public async start(project: Project, restart?: boolean, rebuild?: boolean): Promise<void> {
        if(restart || rebuild) {
            await this.stop(project);
        }

        await this.build(rebuild);

        let container = await this.dockerService.getContainer(`serveo-${project.id}`);

        if(!container) {
            if(!this.pluginConfigService.exists(".ssh")) {
                await this.pluginConfigService.mkdir(".ssh", {
                    recursive: true,
                    mode: 0o700
                });
            }

            container = await this.dockerService.createContainer({
                name: `serveo-${project.id}`,
                image: this.imageName,
                tty: true,
                restart: "always",
                env: {
                    SUBDOMAIN: project.getMeta(SERVEO_SUBDOMAIN_KEY, project.name),
                    CONTAINER: project.containerName,
                    PORT: project.getEnv("VIRTUAL_PORT", "80") as string
                },
                volumes: [
                    `${this.pluginConfigService.dataPath(".ssh")}:/home/${this.user}/.ssh:rw`
                ]
            });
        }

        const {
            State: {
                Running
            }
        } = await container.inspect();

        if(!Running) {
            await container.start();

            const stream = await this.dockerService.attach(container);

            stream.on("data", (data: Buffer): void => {
                if(/Forwarding HTTP traffic/.test(data.toString())) {
                    stream.end();
                }
            });
        }
    }

    public async stop(project: Project): Promise<void> {
        await this.dockerService.removeContainer(`serveo-${project.id}`);
    }

    public async removeOldImages(): Promise<void> {
        // @ts-ignore
        if(!this.appConfigService.isVersionGTE || !this.appConfigService.isVersionGTE("1.0.19")) {
            return;
        }

        // @ts-ignore
        const images = await this.dockerService.imageLs({
            // @ts-ignore
            reference: this.oldImages
        });

        for(const image of images) {
            const {Id} = image;

            // @ts-ignore
            await this.dockerService.imageRm(Id, true);
        }
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
            context: Path.join(__dirname, "../../plugin/serveo"),
            buildArgs: {
                UID: (process.getuid ? process.getuid() : 1000).toString(),
                GID: (process.getgid ? process.getgid() : 1000).toString(),
                USER: this.user
            },
            src: "./Dockerfile"
        });
    }

    public async logs(project: Project): Promise<void> {
        const container = await this.dockerService.getContainer(`serveo-${project.id}`);

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
}
