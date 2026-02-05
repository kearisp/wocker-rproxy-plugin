import {Plugin, PluginConfigService} from "@wocker/core";
import {ReverseProxyController} from "./controllers/ReverseProxyController";
import {ReverseProxyService} from "./services/ReverseProxyService";
import {LocalTunnelService} from "./providers/LocalTunnelService";
import {NgrokService} from "./providers/NgrokService";
import {ServeoService} from "./providers/ServeoService";
import {ExposeService} from "./providers/ExposeService";


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
        LocalTunnelService,
        ExposeService
    ]
})
export default class ReverseProxyPlugin {}
