import {Project} from "@wocker/core";


export abstract class ProxyProvider {
    public abstract init(project: Project): Promise<void>;
    public abstract start(project: Project, restart?: boolean, rebuild?: boolean): Promise<void>;
    public abstract stop(project: Project): Promise<void>;
    public abstract build(rebuild?: boolean): Promise<void>;
    public abstract logs(project: Project): Promise<void>;
}
