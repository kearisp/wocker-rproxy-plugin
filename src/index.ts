import {Plugin, PluginConfigService} from "@wocker/core";

import {ReverseProxyController} from "./controllers/ReverseProxyController";
import {NgrokService} from "./services/NgrokService";
import {ReverseProxyService} from "./services/ReverseProxyService";
import {ServeoService} from "./services/ServeoService";


@Plugin({
    name: "reverse-proxy",
    controllers: [
        ReverseProxyController
    ],
    providers: [
        NgrokService,
        ReverseProxyService,
        ServeoService,
        PluginConfigService
    ]
})
export default class ReverseProxyPlugin {}
