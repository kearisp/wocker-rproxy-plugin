import {Project} from "@wocker/core";
import {Config} from "../makes/Config";


export abstract class ReverseProxyProvider {
    public abstract init(project: Project): Promise<void>;
    public abstract start(config: Config, restart?: boolean, rebuild?: boolean): Promise<void>;
    public abstract stop(config: Config): Promise<void>;
    public abstract build(rebuild?: boolean): Promise<void>;
    public abstract logs(config: Config): Promise<void>;
    public abstract getUrl(config: Config): Promise<string>;
}
