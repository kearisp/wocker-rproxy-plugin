import {
    Injectable,
    Project,
    AppConfigService,
    DockerService,
    PluginConfigService,
    FileSystem
} from "@wocker/core";
import {promptInput} from "@wocker/utils";
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

    public get fs(): FileSystem {
        return this.pluginConfigService.fs;
    }

    public get oldImages(): string[] {
        return [
            "wocker-serveo:latest",
            "wocker-serveo:2.0.0",
            "wocker-serveo:2.0.1"
        ];
    }

    public get imageName(): string {
        return "wocker-serveo:2.0.2";
    }

    public get user(): string {
        return "serveo";
    }

    public async init(project: Project): Promise<void> {
        const subdomain = await promptInput({
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

        let container = await this.dockerService.getContainer(`serveo-${project.name}`);

        if(!container) {
            if(!this.fs.exists(".ssh")) {
                this.fs.mkdir(".ssh", {
                    recursive: true,
                    mode: 0o700
                });
            }

            container = await this.dockerService.createContainer({
                name: `serveo-${project.name}`,
                image: this.imageName,
                tty: true,
                restart: "always",
                env: {
                    SUBDOMAIN: project.getMeta(SERVEO_SUBDOMAIN_KEY, project.name),
                    CONTAINER: project.containerName,
                    PORT: project.getEnv("VIRTUAL_PORT", "80") as string
                },
                volumes: [
                    `${this.fs.path(".ssh")}:/home/${this.user}/.ssh:rw`
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

            if(!stream) {
                return;
            }

            stream.on("data", (data: Buffer): void => {
                if(/Forwarding HTTP traffic/.test(data.toString())) {
                    stream.end();
                }
            });
        }
    }

    public async stop(project: Project): Promise<void> {
        await this.dockerService.removeContainer(`serveo-${project.name}`);
    }

    public async removeOldImages(): Promise<void> {
        if(!this.pluginConfigService.isVersionGTE("1.0.21")) {
            return;
        }

        const images = await this.dockerService.imageLs({
            reference: this.oldImages
        });

        for(const image of images) {
            const {Id} = image;

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
            buildArgs: {
                UID: (process.getuid ? process.getuid() : 1000).toString(),
                GID: (process.getgid ? process.getgid() : 1000).toString(),
                USER: this.user
            },
            context: Path.join(__dirname, "../../plugin/serveo"),
            src: "./Dockerfile",
            dockerfile: "./Dockerfile"
        });
    }

    public async logs(project: Project): Promise<void> {
        await this.dockerService.logs(`serveo-${project.name}`);
    }
}
