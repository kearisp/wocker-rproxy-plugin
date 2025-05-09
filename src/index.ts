import {Plugin, PluginConfigService} from "@wocker/core";
import {ReverseProxyController} from "./controllers/ReverseProxyController";
import {ReverseProxyService} from "./services/ReverseProxyService";
import {LocalTunnelService} from "./providers/LocalTunnelService";
import {NgrokService} from "./providers/NgrokService";
import {ServeoService} from "./providers/ServeoService";


@Plugin({
    name: "reverse-proxy",
    controllers: [
        ReverseProxyController
    ],
    providers: [
        PluginConfigService,
        ReverseProxyService,
        NgrokService,
        ServeoService,
        LocalTunnelService
    ]
})
export default class ReverseProxyPlugin {}
