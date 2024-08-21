import {Injectable, Project, DockerService, PluginConfigService} from "@wocker/core";
import {promptText} from "@wocker/utils";
import * as Path from "path";

import {SERVEO_SUBDOMAIN_KEY} from "../env";


@Injectable()
export class ServeoService {
    public constructor(
        protected readonly pluginConfigService: PluginConfigService,
        protected readonly dockerService: DockerService
    ) {}

    get user(): string {
        return "service";
    }

    get imageName(): string {
        return "wocker-serveo";
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

        if(rebuild) {
            await this.build(project, rebuild);
        }

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
                volumes: [
                    `${this.pluginConfigService.dataPath(".ssh")}:/home/${this.user}/.ssh:rw`
                ],
                env: {
                    SUBDOMAIN: project.getMeta(SERVEO_SUBDOMAIN_KEY, project.name),
                    CONTAINER: project.containerName
                }
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

    public async build(project: Project, rebuild?: boolean): Promise<void> {
        if(await this.dockerService.imageExists(this.imageName)) {
            if(!rebuild) {
                return;
            }

            await this.stop(project);
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
