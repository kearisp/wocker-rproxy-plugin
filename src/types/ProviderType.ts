export enum ProviderTypeEnum {
    NGROK = "ngrok",
    SERVEO = "serveo",
    LT = "local-tunnel",
    EXPOSE = "expose"
}

export type ProviderType = ProviderTypeEnum;

export const ProviderType = Object.assign({}, ProviderTypeEnum, {
    options() {
        return ProviderType.values().map((providerType) => {
            return {
                label: ProviderType.getLabel(providerType),
                value: providerType
            };
        });
    },
    values() {
        return Object.values(ProviderTypeEnum);
    },
    getLabel(provider: ProviderTypeEnum) {
        switch(provider) {
            case ProviderType.NGROK:
                return "Ngrok";

            case ProviderType.SERVEO:
                return "Serveo";

            case ProviderType.LT:
                return "LocalTunnel";

            case ProviderType.EXPOSE:
                return "Expose (unstable)";

            default:
                throw new Error(`Unknown provider: ${provider}`);
        }
    }
});
