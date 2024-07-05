import {Injectable, Project} from "@wocker/core";
import {promptConfirm, promptSelect} from "@wocker/utils";

import {NgrokService} from "./NgrokService";
import {ServeoService} from "./ServeoService";
import {LocalTunnelService} from "./LocalTunnelService";
import {PROXY_TYPE_KEY} from "../env";


@Injectable()
export class ReverseProxyService {
    public constructor(
        protected readonly ngrokService: NgrokService,
        protected readonly serveoService: ServeoService,
        protected readonly localTunnelService: LocalTunnelService
    ) {}

    public async onStart(project: Project): Promise<void> {
        if(!project || !project.getMeta(PROXY_TYPE_KEY)) {
            return;
        }

        await this.start(project);
    }

    public async onStop(project: Project): Promise<void> {
        if(!project || !project.getMeta(PROXY_TYPE_KEY)) {
            return;
        }

        await this.stop(project);
    }

    public async init(project: Project): Promise<void> {
        const enabled = await promptConfirm({
            message: "Enable reverse proxy?",
            default: !!project.getMeta(PROXY_TYPE_KEY)
        });

        if(!enabled) {
            project.unsetMeta(PROXY_TYPE_KEY);

            await project.save();

            return;
        }

        const proxyName = await promptSelect({
            message: "Reverse proxy:",
            options: [
                {label: "Ngrok", value: "ngrok"},
                {label: "Serveo", value: "serveo"},
                {label: "LocalTunnel", value: "localtunnel"}
            ],
            default: project.getMeta(PROXY_TYPE_KEY)
        });

        project.setMeta(PROXY_TYPE_KEY, proxyName);

        switch(proxyName) {
            case "ngrok":
                await this.ngrokService.init(project);
                break;

            case "serveo":
                await this.serveoService.init(project);
                break;

            case "localtunnel":
                await this.localTunnelService.init(project);
                break;
        }

        await project.save();
    }

    public async start(project: Project, restart?: boolean): Promise<void> {
        console.info("Starting reverse proxy...");

        switch(project.getMeta(PROXY_TYPE_KEY)) {
            case "ngrok":
                await this.ngrokService.start(project, restart);
                break;

            case "serveo":
                await this.serveoService.start(project, restart);
                break;

            case "localtunnel":
                await this.localTunnelService.start(project, restart);
                break;
        }
    }

    public async stop(project: Project): Promise<void> {
        console.info("Stopping reverse proxy...");

        switch(project.getMeta(PROXY_TYPE_KEY)) {
            case "ngrok":
                await this.ngrokService.stop(project);
                break;

            case "serveo":
                await this.serveoService.stop(project);
                break;

            case "localtunnel":
                await this.localTunnelService.stop(project);
                break;
        }
    }

    public async build(project: Project, rebuild?: boolean): Promise<void> {
        switch(project.getMeta(PROXY_TYPE_KEY)) {
            case "ngrok":
                await this.ngrokService.build(rebuild);
                break;

            case "serveo":
                await this.serveoService.build(project, rebuild);
                break;

            case "localtunnel":
                await this.localTunnelService.build(project, rebuild);
                break;
        }
    }

    public async logs(project: Project): Promise<void> {
        switch(project.getMeta(PROXY_TYPE_KEY)) {
            case "ngrok":
                await this.ngrokService.logs(project);
                break;

            case "serveo":
                await this.serveoService.logs(project);
                break;

            case "localtunnel":
                await this.localTunnelService.logs(project);
                break;
        }
    }
}