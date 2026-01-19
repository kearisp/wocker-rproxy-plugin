import {Project} from "@wocker/core";
import {
    SUBDOMAIN_KEY
} from "../env";


export class Config {
    public constructor(
        protected readonly name: string,
        protected readonly subdomain?: string
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
            project.name,
            project.getEnv(SUBDOMAIN_KEY)
        );
    }
}
