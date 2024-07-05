import {Plugin, PluginConfigService} from "@wocker/core";

import {ReverseProxyController} from "./controllers/ReverseProxyController";
import {NgrokService} from "./services/NgrokService";
import {ReverseProxyService} from "./services/ReverseProxyService";
import {ServeoService} from "./services/ServeoService";
import {LocalTunnelService} from "./services/LocalTunnelService";


@Plugin({
    name: "reverse-proxy",
    controllers: [
        ReverseProxyController
    ],
    providers: [
        NgrokService,
        ReverseProxyService,
        ServeoService,
        LocalTunnelService,
        PluginConfigService
    ]
})
export default class ReverseProxyPlugin {}
