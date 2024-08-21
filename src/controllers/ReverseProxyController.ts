import {
    Controller,
    Project,
    Command,
    Option,
    AppEventsService,
    ProjectService
} from "@wocker/core";

import {ReverseProxyService} from "../services/ReverseProxyService";


@Controller()
export class ReverseProxyController {
    public constructor(
        protected readonly appEventsService: AppEventsService,
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
    public async init(
        @Option("name", {
            type: "string",
            alias: "n",
            description: "The name of the project"
        })
        name?: string
    ): Promise<void> {
        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        await this.reverseProxyService.init(project);
    }

    @Command("rproxy:start")
    public async start(
        @Option("name", {
            type: "string",
            alias: "n",
            description: "The name of the project"
        })
        name?: string,
        @Option("restart", {
            type: "boolean",
            alias: "r",
            description: "Restart"
        })
        restart?: boolean,
        @Option("build", {
            type: "boolean",
            alias: "b",
            description: "Build image"
        })
        build?: boolean
    ): Promise<void> {
        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        await this.reverseProxyService.start(project, restart, build);
    }

    @Command("rproxy:stop")
    public async stop(
        @Option("name", {
            type: "string",
            alias: "n",
            description: "The name of the project"
        })
        name?: string
    ): Promise<void> {
        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        await this.reverseProxyService.stop(project);
    }

    @Command("rproxy:logs")
    public async logs(
        @Option("name", {
            type: "string",
            alias: "n",
            description: "The name of the project"
        })
        name?: string
    ): Promise<void> {
        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        await this.reverseProxyService.logs(project);
    }
}
