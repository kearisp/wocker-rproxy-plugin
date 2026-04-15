import {
    Injectable,
    Project,
    AppConfigService,
    DockerService,
    PluginConfigService,
    FileSystem,
    KeystoreService
} from "@wocker/core";
import {promptInput} from "@wocker/prompts";
import * as Path from "path";
import {ReverseProxyProvider} from "../types/ReverseProxyProvider";
import {Config} from "../makes/Config";
import {
    SUBDOMAIN_KEY,
    EXPOSE_TOKEN_KEY,
    EXPOSE_SERVER_KEY
} from "../env";


@Injectable()
export class ExposeProvider implements ReverseProxyProvider {
    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly pluginConfigService: PluginConfigService,
        protected readonly dockerService: DockerService,
        protected readonly keystoreService: KeystoreService
    ) {}

    public get fs(): FileSystem {
        return this.pluginConfigService.fs;
    }

    public get imageName(): string {
        return "wocker-expose:1.0.0";
    }

    public async init(project: Project): Promise<void> {
        if(!this.pluginConfigService.isVersionGTE("1.0.22")) {
            throw new Error("Please upgrade @wocker/ws to version 1.0.22 or higher to enable secure key storage using keystore (encrypted file or keytar)");
        }

        const token = await promptInput({
            required: true,
            message: "Expose Auth Token:",
            type: "password",
            default: await this.keystoreService.get(EXPOSE_TOKEN_KEY) || project.getMeta(EXPOSE_TOKEN_KEY)
        });

        await this.keystoreService.set(EXPOSE_TOKEN_KEY, token);

        const subdomain = await promptInput({
            message: "Subdomain",
            suffix: ".sharedwithexpose.com",
            default: project.getMeta(SUBDOMAIN_KEY, project.name)
        });

        project.setMeta(SUBDOMAIN_KEY, subdomain);

        const server = await promptInput({
            message: "Expose Server",
            default: this.appConfigService.getMeta(EXPOSE_SERVER_KEY) || project.getMeta(EXPOSE_SERVER_KEY, "sharedwithexpose.com")
        });

        this.appConfigService.setMeta(EXPOSE_SERVER_KEY, server);

        project.unsetMeta(EXPOSE_TOKEN_KEY);
        project.unsetMeta(EXPOSE_SERVER_KEY);
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
                tty: true,
                // restart: "always",
                env: {
                    EXPOSE_TOKEN: await this.keystoreService.get(EXPOSE_TOKEN_KEY) || "",
                    EXPOSE_SERVER: this.appConfigService.getMeta(EXPOSE_SERVER_KEY, "sharedwithexpose.com") || "",
                    CONTAINER: config.name,
                    PORT: config.port
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

    public async stop(config: Config): Promise<void> {
        await this.dockerService.removeContainer(config.containerName);
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
            context: Path.join(__dirname, "../../provider/expose"),
            src: "./Dockerfile",
            dockerfile: "./Dockerfile"
        });
    }

    public async logs(config: Config): Promise<void> {
        await this.dockerService.logs(config.containerName);
    }

    public async getUrl(_config: Config): Promise<string> {
        throw new Error("Unsupported");
    }
}
