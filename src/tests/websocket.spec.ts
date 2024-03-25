import 'reflect-metadata';

import {WebsocketConnection, type WebsocketConnectionOptions} from '../websocket';

class TestWebsocket extends WebsocketConnection {
    testWebsocketNormalization(options: WebsocketConnectionOptions) {
        const normalized = this.normalize_endpoints(options, 'ws://', '/ws') as Array<string>;
        return normalized.values().next().value;
    }

    getSnapshotEndpoint(): string {
        return this.$snapshot_endpoints.values().next().value;
    }

    getWebSocketEndpoint(): string {
        return this.$ws_endpoints.values().next().value;
    }
}

const options: WebsocketConnectionOptions = {
    endpoints: "localhost:3002",
    apiKey: "some_strong_api_key1",
    apiHost: "localhost:5000",
    channels: ["ticker3", "iss", "iss2", "ticks", "yahoo1"],
    snapshot: true
};

describe('websocket', () => {
    it('normalize_endpoint works on dev', () => {
        const to = {...options, env: 'dev'} as WebsocketConnectionOptions;
        const tt = new TestWebsocket(to);
        expect(tt.testWebsocketNormalization(to)).toEqual("ws://localhost:3002/ws?api_key=some_strong_api_key1&api_host=localhost:5000&channels=ticker3,iss,iss2,ticks,yahoo1&snapshot=true");
    });

    it('normalize_endpoint works on prod', () => {
        const to = {...options, env: 'prod'} as WebsocketConnectionOptions;
        const tt = new TestWebsocket(to);
        expect(tt.testWebsocketNormalization(to)).toEqual("ws://localhost:3002/ws?api_key=some_strong_api_key1&api_host=localhost:5000&channels=ticker3,iss,iss2,ticks,yahoo1&snapshot=true");
    });

    it('endpoint is generated correctly', () => {
        const tt = new TestWebsocket(options);
        expect(tt.getWebSocketEndpoint()).toEqual("wss://localhost:3002/ws?api_key=some_strong_api_key1&api_host=localhost:5000&channels=ticker3,iss,iss2,ticks,yahoo1&snapshot=true");
    });

    it('snapshot is generated correctly when snapshot is true', () => {
        const new_options = options;
        new_options.snapshot = true;
        const tt = new TestWebsocket(new_options);
        expect(tt.getWebSocketEndpoint()).toEqual("wss://localhost:3002/ws?api_key=some_strong_api_key1&api_host=localhost:5000&channels=ticker3,iss,iss2,ticks,yahoo1&snapshot=true");
    });

    it('snapshot is generated correctly when snapshot is false', () => {
        const new_options = options;
        new_options.snapshot = false;
        const tt = new TestWebsocket(new_options);
        expect(tt.getWebSocketEndpoint()).toEqual("wss://localhost:3002/ws?api_key=some_strong_api_key1&api_host=localhost:5000&channels=ticker3,iss,iss2,ticks,yahoo1&snapshot=false");
    });

    it('works with channels as string', () => {
        const new_options = options;
        new_options.channels = 'ticks';
        const tt = new TestWebsocket(new_options);
        expect(tt.getWebSocketEndpoint()).toEqual("wss://localhost:3002/ws?api_key=some_strong_api_key1&api_host=localhost:5000&channels=ticks&snapshot=false");
    });

    it('works with multiple channels as string', () => {
        const new_options = options;
        new_options.channels = 'ticks,yahoo';
        const tt = new TestWebsocket(new_options);
        expect(tt.getWebSocketEndpoint()).toEqual("wss://localhost:3002/ws?api_key=some_strong_api_key1&api_host=localhost:5000&channels=ticks,yahoo&snapshot=false");
    });

    it('works with multiple channels as string with extract spaces', () => {
        const new_options = options;
        new_options.channels = '   ticks , yahoo       ';
        const tt = new TestWebsocket(new_options);
        expect(tt.getWebSocketEndpoint()).toEqual("wss://localhost:3002/ws?api_key=some_strong_api_key1&api_host=localhost:5000&channels=ticks,yahoo&snapshot=false");
    });

    it('snapshot works with multiple channels as string with extract spaces', () => {
        const new_options = options;
        new_options.channels = '   ticks , yahoo       ';
        const tt = new TestWebsocket(new_options);
        expect(tt.getSnapshotEndpoint()).toEqual("https://localhost:3002/snapshot?api_key=some_strong_api_key1&api_host=localhost:5000&channels=ticks,yahoo&snapshot=false");
    });
});
