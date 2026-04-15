import {
    Controller,
    Completion,
    Description,
    Project,
    Command,
    Param,
    Option,
    AppConfigService,
    EventService,
    PluginConfigService,
    ProjectService
} from "@wocker/core";
import {ReverseProxyService} from "../services/ReverseProxyService";
import {ProviderType} from "../types/ProviderType";
import {PROXY_ENABLED} from "../env";


@Controller()
@Description("Reverse proxy commands")
export class ReverseProxyController {
    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly appEventsService: EventService,
        protected readonly pluginConfigService: PluginConfigService,
        protected readonly reverseProxyService: ReverseProxyService,
        protected readonly projectService: ProjectService
    ) {
        this.appEventsService.on("project:init", (project: Project): Promise<void> => {
            return this.reverseProxyService.onInit(project);
        });

        this.appEventsService.on("project:start", (project: Project): Promise<void> => {
            return this.reverseProxyService.onStart(project);
        });

        this.appEventsService.on("project:stop", (project: Project): Promise<void> => {
            return this.reverseProxyService.onStop(project);
        });
    }

    @Command("rproxy:init")
    @Description("Initialize and configure reverse proxy settings for the project")
    public async init(
        @Option("name", "n")
        @Description("The name of the project")
        name?: string,
        @Option("provider", "p")
        @Description("Proxy provider")
        provider?: ProviderType,
        @Option("subdomain", "s")
        @Description("Subdomain")
        subdomain?: string
    ): Promise<void> {
        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        await this.reverseProxyService.init(project);
    }

    @Command("rproxy")
    @Description("List of reverse proxies")
    public async list() {
        return this.reverseProxyService.list();
    }

    @Command("rproxy:start")
    @Description("Start reverse proxy container with optional rebuild and restart capabilities")
    public async start(
        @Option("name", "n")
        @Description("The name of the project")
        name?: string,
        @Option("restart", "r")
        @Description("Force restart of the reverse proxy container even if it's already running")
        restart?: boolean,
        @Option("build", "b")
        @Description("Rebuild the reverse proxy container image before starting")
        build?: boolean
    ): Promise<void> {
        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        await this.reverseProxyService.start(project, restart, build);
    }

    @Command("rproxy:stop")
    @Description("Stop running reverse proxy container")
    public async stop(
        @Option("name", "n")
        @Description("The name of the project")
        name?: string
    ): Promise<void> {
        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        await this.reverseProxyService.stop(project);
    }

    @Command("rproxy:logs")
    @Description("Display reverse proxy container logs")
    public async logs(
        @Option("name", "n")
        @Description("The name of the project")
        name?: string
    ): Promise<void> {
        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        await this.reverseProxyService.logs(project);
    }

    @Command("rproxy:url [name]")
    public async url(
        @Param("name")
        @Description("The name of the project")
        name?: string
    ) {
        const project = this.projectService.get(name);

        return this.reverseProxyService.url(project);
    }

    @Command("rproxy:enable")
    @Description("Enable reverse proxy for the project")
    public async enable(
        @Option("name", "n")
        @Description("The name of the project")
        name?: string
    ): Promise<void> {
        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        await this.reverseProxyService.enable(project);
    }

    @Command("rproxy:disable")
    @Description("Disable reverse proxy for the project")
    public async disable(
        @Option("name", "n")
        @Description("The name of the project")
        name?: string
    ): Promise<void> {
        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        project.setMeta(PROXY_ENABLED, "false");

        await project.save();
    }

    @Completion("name")
    public getProjectNames(): string[] {
        if(!this.pluginConfigService.isVersionGTE("1.0.21")) {
            return [];
        }

        const {
            projects = []
        } = this.appConfigService.config;

        return projects
            .map((projectData) => projectData.name)
            .filter(Boolean) as string[];
    }
}
