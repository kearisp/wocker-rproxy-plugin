import {Injectable, Project, DockerService} from "@wocker/core"
import {ProxyProvider} from "../types/ProxyProvider";


@Injectable()
export class CloudflareService implements ProxyProvider {
    // protected readonly imageName = "";

    public constructor(
        protected readonly dockerService: DockerService
    ) {}

    public async init(project: Project): Promise<void> {

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
