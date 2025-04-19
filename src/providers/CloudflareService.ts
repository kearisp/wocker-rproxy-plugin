import {
    Injectable,
    Project,
    PluginConfigService,
    DockerService,
    KeystoreService
} from "@wocker/core";
import {promptInput} from "@wocker/utils";
import {ProxyProvider} from "../types/ProxyProvider";


@Injectable()
export class CloudflareService implements ProxyProvider {
    // protected readonly imageName = "";

    public constructor(
        protected readonly pluginConfigService: PluginConfigService,
        protected readonly keystoreService: KeystoreService,
        protected readonly dockerService: DockerService
    ) {}

    public async init(project: Project): Promise<void> {
        const ACCOUNT_ID = await promptInput({
            required: true,
            type: "password",
            message: "ACCOUNT_ID"
        });

        const API_TOKEN = await promptInput({
            required: true,
            type: "password",
            message: "CLOUDFLARE_API_TOKEN"
        });

        const name = this.pluginConfigService.fs.basename();

        await this.keystoreService.set(`plugin:${name}:CLOUDFLARE_ACCOUNT_ID`, ACCOUNT_ID);
        await this.keystoreService.set(`plugin:${name}:CLOUDFLARE_API_TOKEN`, API_TOKEN);
    }

    public async start(project: Project, restart?: boolean, rebuild?: boolean): Promise<void> {
        let container = await this.dockerService.getContainer(`cloudflared-${project.name}`);

        if(container && (restart || rebuild)) {
            await this.stop(project);
            container = null;
        }

        if(!container) {
            await this.build(rebuild);

            container = await this.dockerService.createContainer({
                name: `cloudflared-${project.name}`,
                image: "cloudflare/cloudflared:latest",
                cmd: [
                    "tunnel",
                    "--no-autoupdate",
                    "--hello-world"
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
        }
    }

    public async stop(project: Project): Promise<void> {
        await this.dockerService.removeContainer(`cloudflared-${project.name}`);
    }

    public async build(rebuild?: boolean): Promise<void> {
        //
    }

    public async logs(project: Project): Promise<void> {
        //
    }
}
