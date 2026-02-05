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
import {
    SUBDOMAIN_KEY,
    EXPOSE_TOKEN_KEY,
    EXPOSE_SERVER_KEY
} from "../env";


@Injectable()
export class ExposeService implements ProxyProvider {
    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly pluginConfigService: PluginConfigService,
        protected readonly dockerService: DockerService
    ) {}

    public get fs(): FileSystem {
        return this.pluginConfigService.fs;
    }

    public get imageName(): string {
        return "wocker-expose:1.0.0";
    }

    public async init(project: Project): Promise<void> {
        const token = await promptInput({
            message: "Expose Auth Token: ",
            default: project.getMeta(EXPOSE_TOKEN_KEY, "")
        });

        if(token) {
            project.setMeta(EXPOSE_TOKEN_KEY, token);
        }

        const subdomain = await promptInput({
            message: "Subdomain: ",
            suffix: ".sharedwithexpose.com",
            default: project.getMeta(SUBDOMAIN_KEY, project.name)
        });

        project.setMeta(SUBDOMAIN_KEY, subdomain);

        const server = await promptInput({
            message: "Expose Server: ",
            default: project.getMeta(EXPOSE_SERVER_KEY, "sharedwithexpose.com")
        });

        project.setMeta(EXPOSE_SERVER_KEY, server);
    }

    public async start(project: Project, restart?: boolean, rebuild?: boolean): Promise<void> {
        if(restart || rebuild) {
            await this.stop(project);
        }

        await this.build(rebuild);

        let container = await this.dockerService.getContainer(`expose-${project.name}`);

        if(!container) {
            container = await this.dockerService.createContainer({
                name: `expose-${project.name}`,
                image: this.imageName,
                tty: true,
                // restart: "always",
                env: {
                    EXPOSE_TOKEN: project.getMeta(EXPOSE_TOKEN_KEY, "") || "",
                    EXPOSE_SERVER: project.getMeta(EXPOSE_SERVER_KEY, "sharedwithexpose.com") || "",
                    CONTAINER: project.containerName,
                    PORT: project.getEnv("VIRTUAL_PORT", "80") || "80"
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
        }
    }

    public async stop(project: Project): Promise<void> {
        await this.dockerService.removeContainer(`expose-${project.name}`);
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
            context: Path.join(__dirname, "../../plugin/expose"),
            src: "./Dockerfile",
            dockerfile: "./Dockerfile"
        });
    }

    public async logs(project: Project): Promise<void> {
        await this.dockerService.logs(`expose-${project.name}`);
    }
}
