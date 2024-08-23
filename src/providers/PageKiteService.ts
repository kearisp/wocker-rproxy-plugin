import {
    Injectable,
    Project,
    DockerService
} from "@wocker/core";
import * as Path from "path";

import {ProxyProvider} from "../types/ProxyProvider";
import {PAGE_KITE_SUBDOMAIN_KEY} from "../env";


@Injectable()
export class PageKiteService implements ProxyProvider {
    protected imageName = "ws-pagekite";

    public constructor(
        protected readonly dockerService: DockerService
    ) {}

    public async init(project: Project): Promise<void> {

    }

    public async start(project: Project, restart?: boolean, rebuild?: boolean): Promise<void> {
        if(restart || rebuild) {
            await this.stop(project);
        }

        await this.build(rebuild);

        let container = await this.dockerService.getContainer(`pagekite-${project.id}`);

        if(!container) {
            container = await this.dockerService.createContainer({
                name: `pagekite-${project.id}`,
                image: this.imageName,
                tty: true,
                env: {
                    CONTAINER: "timer.workspace",
                    PORT: "80"
                },
                restart: "always"
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
        await this.dockerService.removeContainer(`pagekite-${project.id}`);
    }

    public async build(rebuild?: boolean): Promise<void> {
        console.log(this.dockerService);

        if(await this.dockerService.imageExists(this.imageName)) {
            if(!rebuild) {
                return;
            }

            await this.dockerService.imageRm(this.imageName);
        }

        await this.dockerService.buildImage({
            tag: this.imageName,
            context: Path.join(__dirname, "../../plugin/pagekite"),
            buildArgs: {

            },
            src: "./Dockerfile"
        });
    }

    public async logs(project: Project): Promise<void> {
        //
    }
}
