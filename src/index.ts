import {Plugin, PluginConfigService} from "@wocker/core";
import {ReverseProxyController} from "./controllers/ReverseProxyController";
import {ReverseProxyService} from "./services/ReverseProxyService";
import {LocalTunnelProvider} from "./providers/LocalTunnelProvider";
import {NgrokProvider} from "./providers/NgrokProvider";
import {ServeoProvider} from "./providers/ServeoProvider";
import {ExposeProvider} from "./providers/ExposeProvider";


@Plugin({
    name: "reverse-proxy",
    controllers: [
        ReverseProxyController
    ],
    providers: [
        PluginConfigService,
        ReverseProxyService,
        NgrokProvider,
        ServeoProvider,
        LocalTunnelProvider,
        ExposeProvider
    ]
})
export default class ReverseProxyPlugin {}
