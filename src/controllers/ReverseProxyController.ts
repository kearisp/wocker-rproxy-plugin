import {
    Controller,
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
        this.appEventsService.on("project:start", (project) => {
            return this.reverseProxyService.onStart(project);
        });

        this.appEventsService.on("project:stop", (project) => {
            return this.reverseProxyService.onStop(project);
        });
    }

    @Command("rproxy:init")
    public async init(
        @Option("name", {
            type: "string",
            alias: "n",
            description: "Project name"
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
            description: "Project name"
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

        await this.reverseProxyService.build(project, build);
        await this.reverseProxyService.start(project, restart);
    }

    @Command("rproxy:stop")
    public async stop(
        @Option("name", {
            type: "string",
            alias: "n",
            description: "Project name"
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
            description: "Project name"
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
