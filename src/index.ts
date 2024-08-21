import {Plugin, PluginConfigService} from "@wocker/core";

import {ReverseProxyController} from "./controllers/ReverseProxyController";
import {ReverseProxyService} from "./services/ReverseProxyService";
import {NgrokService} from "./services/NgrokService";
import {ServeoService} from "./services/ServeoService";
import {LocalTunnelService} from "./services/LocalTunnelService";


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
