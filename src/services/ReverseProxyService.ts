import {Injectable, Project} from "@wocker/core";
import {promptConfirm, promptSelect} from "@wocker/utils";

import {CloudflareService} from "../providers/CloudflareService";
import {ProxyProvider} from "../types/ProxyProvider";
import {NgrokService} from "../providers/NgrokService";
import {ServeoService} from "../providers/ServeoService";
import {LocalTunnelService} from "../providers/LocalTunnelService";
import {
    PROXY_TYPE_KEY,
    TYPE_SERVEO,
    TYPE_NGROK,
    TYPE_LT,
    TYPE_CLOUDFLARE
} from "../env";


@Injectable()
export class ReverseProxyService {
    public constructor(
        protected readonly cloudflareService: CloudflareService,
        protected readonly ngrokService: NgrokService,
        protected readonly serveoService: ServeoService,
        protected readonly localTunnelService: LocalTunnelService
    ) {}

    public getProvider(type: string): ProxyProvider {
        switch(type) {
            case TYPE_LT:
                return this.localTunnelService;

            case TYPE_SERVEO:
                return this.serveoService;

            case TYPE_NGROK:
                return this.ngrokService;

            case TYPE_CLOUDFLARE:
                return this.cloudflareService;

            default:
                throw new Error(`Reverse proxy provider "${type}" not found.`);
        }
    }

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
                {label: "LocalTunnel", value: TYPE_LT},
                {label: "Cloudflared", value: TYPE_CLOUDFLARE}
            ],
            default: project.getMeta(PROXY_TYPE_KEY)
        });

        const provider = this.getProvider(proxyName);

        if(project.getMeta(PROXY_TYPE_KEY)) {
            try {
                await this.getProvider(project.getMeta(PROXY_TYPE_KEY))
                    .stop(project);
            }
            catch(err) {
                console.log(err);
            }
        }

        project.setMeta(PROXY_TYPE_KEY, proxyName);

        await provider.init(project);

        await project.save();
    }

    public async start(project: Project, restart?: boolean, rebuild?: boolean): Promise<void> {
        console.info("Starting reverse proxy...");

        const provider = this.getProvider(project.getMeta(PROXY_TYPE_KEY));

        await provider.start(project, restart, rebuild);
    }

    public async stop(project: Project): Promise<void> {
        console.info("Stopping reverse proxy...");

        const provider = this.getProvider(project.getMeta(PROXY_TYPE_KEY));

        await provider.stop(project);
    }

    public async build(project: Project, rebuild?: boolean): Promise<void> {
        const provider = this.getProvider(project.getMeta(PROXY_TYPE_KEY));

        await provider.build(rebuild);
    }

    public async logs(project: Project): Promise<void> {
        const provider = this.getProvider(project.getMeta(PROXY_TYPE_KEY));

        await provider.logs(project);
    }
}
