import {Injectable, Project, ProjectService, DockerService} from "@wocker/core";
import {promptSelect} from "@wocker/utils";
import CliTable from "cli-table3";
import {ReverseProxyProvider} from "../types/ReverseProxyProvider";
import {NgrokProvider} from "../providers/NgrokProvider";
import {ServeoProvider} from "../providers/ServeoProvider";
import {LocalTunnelProvider} from "../providers/LocalTunnelProvider";
import {ExposeProvider} from "../providers/ExposeProvider";
import {ProviderType} from "../types/ProviderType";
import {PROXY_TYPE_KEY, PROXY_ENABLED, SUBDOMAIN_KEY} from "../env";
import {Config} from "../makes/Config";


@Injectable()
export class ReverseProxyService {
    public constructor(
        protected readonly projectService: ProjectService,
        protected readonly dockerService: DockerService,
        protected readonly ngrokService: NgrokProvider,
        protected readonly serveoService: ServeoProvider,
        protected readonly localTunnelService: LocalTunnelProvider,
        protected readonly exposeService: ExposeProvider
    ) {}

    public getProvider(type: ProviderType): ReverseProxyProvider {
        switch(type) {
            case ProviderType.LT:
                return this.localTunnelService;

            case ProviderType.SERVEO:
                return this.serveoService;

            case ProviderType.NGROK:
                return this.ngrokService;

            case ProviderType.EXPOSE:
                return this.exposeService;

            default:
                throw new Error(`Reverse proxy provider "${type}" not found.`);
        }
    }

    public async onStart(project: Project): Promise<void> {
        if(!project || !project.getMeta(PROXY_TYPE_KEY)) {
            return;
        }

        if(project.getMeta(PROXY_ENABLED) === "false") {
            return;
        }

        await this.start(project);
    }

    public async onStop(project: Project): Promise<void> {
        if(!project || !project.getMeta(PROXY_TYPE_KEY)) {
            return;
        }

        if(project.getMeta(PROXY_ENABLED) === "false") {
            return;
        }

        await this.stop(project);
    }

    public async enable(project: Project) {
        project.setMeta(PROXY_ENABLED, "true");

        if(!project.hasMeta(PROXY_TYPE_KEY)) {
            await this.init(project);
        }
    }

    public async init(project: Project): Promise<void> {
        const proxyName = await promptSelect<ProviderType>({
            message: "Reverse proxy",
            required: true,
            options: ProviderType.options(),
            default: project.getMeta(PROXY_TYPE_KEY)
        });

        const provider = this.getProvider(proxyName);

        if(project.getMeta(PROXY_TYPE_KEY)) {
            try {
                const config = Config.fromProject(project);
                await this.getProvider(project.getMeta(PROXY_TYPE_KEY))
                    .stop(config);
            }
            catch(err) {
                console.error(err);
            }
        }

        project.setMeta(PROXY_TYPE_KEY, proxyName);

        await provider.init(project);

        return project.save();
    }

    public async list() {
        const projects = this.projectService.search({});

        const table = new CliTable({
            head: ["Project", "Provider", "Enabled", "Subdomain"]
        });

        for(const project of projects) {
            if(!project.hasMeta(PROXY_TYPE_KEY)) {
                continue;
            }

            table.push([
                project.name,
                ProviderType.getLabel(project.getMeta(PROXY_TYPE_KEY)),
                project.getMeta(PROXY_ENABLED, "true"),
                project.getMeta(SUBDOMAIN_KEY, "-")
            ]);
        }

        return table.toString();
    }

    public async start(project: Project, restart?: boolean, rebuild?: boolean): Promise<void> {
        console.info("Starting reverse proxy...");

        const provider = this.getProvider(project.getMeta(PROXY_TYPE_KEY)),
              config = Config.fromProject(project);

        await provider.start(config, restart, rebuild);
    }

    public async stop(project: Project): Promise<void> {
        console.info("Stopping reverse proxy...");

        const provider = this.getProvider(project.getMeta(PROXY_TYPE_KEY)),
              config = Config.fromProject(project);

        await provider.stop(config);

        for(const oldName of config.oldNames) {
            await this.dockerService.removeContainer(oldName);
        }
    }

    public async build(project: Project, rebuild?: boolean): Promise<void> {
        const provider = this.getProvider(project.getMeta(PROXY_TYPE_KEY));

        await provider.build(rebuild);
    }

    public async logs(project: Project): Promise<void> {
        const provider = this.getProvider(project.getMeta(PROXY_TYPE_KEY)),
              config = Config.fromProject(project);

        await provider.logs(config);
    }

    public async url(project: Project) {
        const provider = this.getProvider(project.getMeta(PROXY_TYPE_KEY)),
              config = Config.fromProject(project);

        return provider.getUrl(config);
    }
}
