import {Config} from "./Config";


export class BulkConfig {
    public constructor(
        public readonly configs: Config[]
    ) {}

    public static fromLabels(labels: Record<string, string>): BulkConfig {
        const configs: Config[] = [];

        for(const [key, value] of Object.entries(labels)) {
            if(key.startsWith("wocker.rproxy.target.")) {
                const target = key.replace("wocker.rproxy.target.", "");
                const [name, port] = target.split(":");

                configs.push(new Config(
                    name,
                    port,
                    value || undefined
                ));
            }
        }

        return new BulkConfig(configs);
    }
}
