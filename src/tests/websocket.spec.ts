import 'reflect-metadata';

import {WebsocketConnection, type WebsocketConnectionOptions} from '../websocket';

class TestWebsocket extends WebsocketConnection {
    testNormalization(options: WebsocketConnectionOptions) {
        return this.normalize_endpoint(options);
    }

    getEndpoint(): string {
        return this.endpoint;
    }
}

const options: WebsocketConnectionOptions = {
    endpoint: "localhost:3002",
    apiKey: "some_strong_api_key1",
    apiHost: "localhost:5000",
    channels: ["ticker3", "iss", "iss2", "ticks", "yahoo1"],
    snapshot: true
};

describe('websocket', () => {
    it('normalize_endpoint works on dev', () => {
        const to = {...options, env: 'dev'} as WebsocketConnectionOptions;
        const tt = new TestWebsocket(to);
        expect(tt.testNormalization(to)).toEqual("ws://localhost:3002/ws?api_key=some_strong_api_key1&api_host=localhost:5000&channels=ticker3,iss,iss2,ticks,yahoo1&snapshot=true");
    });

    it('normalize_endpoint works on prod', () => {
        const to = {...options, env: 'prod'} as WebsocketConnectionOptions;
        const tt = new TestWebsocket(to);
        expect(tt.testNormalization(to)).toEqual("wss://localhost:3002/ws?api_key=some_strong_api_key1&api_host=localhost:5000&channels=ticker3,iss,iss2,ticks,yahoo1&snapshot=true");
    });

    it('endpoint is generated correctly', () => {
        const tt = new TestWebsocket(options);
        expect(tt.getEndpoint()).toEqual("wss://localhost:3002/ws?api_key=some_strong_api_key1&api_host=localhost:5000&channels=ticker3,iss,iss2,ticks,yahoo1&snapshot=true");
    });

    it('snapshot is generated correctly when snapshot is true', () => {
        const new_options = options;
        new_options.snapshot = true;
        const tt = new TestWebsocket(new_options);
        expect(tt.getEndpoint()).toEqual("wss://localhost:3002/ws?api_key=some_strong_api_key1&api_host=localhost:5000&channels=ticker3,iss,iss2,ticks,yahoo1&snapshot=true");
    });

    it('snapshot is generated correctly when snapshot is false', () => {
        const new_options = options;
        new_options.snapshot = false;
        const tt = new TestWebsocket(new_options);
        expect(tt.getEndpoint()).toEqual("wss://localhost:3002/ws?api_key=some_strong_api_key1&api_host=localhost:5000&channels=ticker3,iss,iss2,ticks,yahoo1&snapshot=false");
    });

    it('works with channels as string', () => {
        const new_options = options;
        new_options.channels = 'ticks';
        const tt = new TestWebsocket(new_options);
        expect(tt.getEndpoint()).toEqual("wss://localhost:3002/ws?api_key=some_strong_api_key1&api_host=localhost:5000&channels=ticks&snapshot=false");
    });

    it('works with multiple channels as string', () => {
        const new_options = options;
        new_options.channels = 'ticks,yahoo';
        const tt = new TestWebsocket(new_options);
        expect(tt.getEndpoint()).toEqual("wss://localhost:3002/ws?api_key=some_strong_api_key1&api_host=localhost:5000&channels=ticks,yahoo&snapshot=false");
    });

    it('works with multiple channels as string with extract spaces', () => {
        const new_options = options;
        new_options.channels = '   ticks , yahoo       ';
        const tt = new TestWebsocket(new_options);
        expect(tt.getEndpoint()).toEqual("wss://localhost:3002/ws?api_key=some_strong_api_key1&api_host=localhost:5000&channels=ticks,yahoo&snapshot=false");
    });
});
