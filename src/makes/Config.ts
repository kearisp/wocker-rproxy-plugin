import {Project} from "@wocker/core";
import {
    SUBDOMAIN_KEY
} from "../env";


export class Config {
    public constructor(
        public readonly name: string,
        public readonly port: string,
        public readonly subdomain?: string
    ) {}

    public get containerName(): string {
        return `wocker-rproxy-${this.name}`;
    }

    public get oldNames(): string[] {
        return [
            `expose-${this.name}`,
            `localtunnel-${this.name}`,
            `ngrok-${this.name}`,
            `serveo-${this.name}`
        ];
    }

    public static fromProject(project: Project): Config {
        return new this(
            project.containerName,
            project.getEnv("VIRTUAL_PORT", "80"),
            project.getMeta(SUBDOMAIN_KEY)
        );
    }
}
