import {Injectable, Project} from "@wocker/core";
import {promptConfirm, promptSelect} from "@wocker/utils";

import {NgrokService} from "./NgrokService";
import {ServeoService} from "./ServeoService";
import {LocalTunnelService} from "./LocalTunnelService";
import {
    PROXY_TYPE_KEY,
    TYPE_SERVEO,
    TYPE_NGROK,
    TYPE_LT
} from "../env";


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
                {label: "Ngrok", value: TYPE_NGROK},
                {label: "Serveo", value: TYPE_SERVEO},
                {label: "LocalTunnel", value: TYPE_LT}
            ],
            default: project.getMeta(PROXY_TYPE_KEY)
        });

        project.setMeta(PROXY_TYPE_KEY, proxyName);

        switch(proxyName) {
            case TYPE_NGROK:
                await this.ngrokService.init(project);
                break;

            case TYPE_SERVEO:
                await this.serveoService.init(project);
                break;

            case TYPE_LT:
                await this.localTunnelService.init(project);
                break;
        }

        await project.save();
    }

    public async start(project: Project, restart?: boolean, rebuild?: boolean): Promise<void> {
        console.info("Starting reverse proxy...");

        switch(project.getMeta(PROXY_TYPE_KEY)) {
            case TYPE_NGROK:
                await this.ngrokService.start(project, restart);
                break;

            case TYPE_SERVEO:
                await this.serveoService.start(project, restart, rebuild);
                break;

            case TYPE_LT:
                await this.localTunnelService.start(project, restart);
                break;
        }
    }

    public async stop(project: Project): Promise<void> {
        console.info("Stopping reverse proxy...");

        switch(project.getMeta(PROXY_TYPE_KEY)) {
            case TYPE_NGROK:
                await this.ngrokService.stop(project);
                break;

            case TYPE_SERVEO:
                await this.serveoService.stop(project);
                break;

            case TYPE_LT:
                await this.localTunnelService.stop(project);
                break;
        }
    }

    public async build(project: Project, rebuild?: boolean): Promise<void> {
        switch(project.getMeta(PROXY_TYPE_KEY)) {
            case TYPE_NGROK:
                await this.ngrokService.build(rebuild);
                break;

            case TYPE_SERVEO:
                await this.serveoService.build(project, rebuild);
                break;

            case TYPE_LT:
                await this.localTunnelService.build(project, rebuild);
                break;
        }
    }

    public async logs(project: Project): Promise<void> {
        switch(project.getMeta(PROXY_TYPE_KEY)) {
            case TYPE_NGROK:
                await this.ngrokService.logs(project);
                break;

            case TYPE_SERVEO:
                await this.serveoService.logs(project);
                break;

            case TYPE_LT:
                await this.localTunnelService.logs(project);
                break;
        }
    }
}