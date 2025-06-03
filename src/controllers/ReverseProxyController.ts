import {
    Controller,
    Completion,
    Description,
    Project,
    Command,
    Option,
    AppConfigService,
    AppEventsService,
    PluginConfigService,
    ProjectService
} from "@wocker/core";
import {ReverseProxyService} from "../services/ReverseProxyService";


@Controller()
@Description("Reverse proxy commands")
export class ReverseProxyController {
    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly appEventsService: AppEventsService,
        protected readonly pluginConfigService: PluginConfigService,
        protected readonly reverseProxyService: ReverseProxyService,
        protected readonly projectService: ProjectService
    ) {
        this.appEventsService.on("project:init", (project: Project): Promise<void> => {
            return this.reverseProxyService.init(project);
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
        name?: string
    ): Promise<void> {
        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        await this.reverseProxyService.init(project);
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
