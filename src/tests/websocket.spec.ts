import 'reflect-metadata';

import {WebsocketConnection, WebsocketConnectionOptions} from '../websocket';

class TestWebsocket extends WebsocketConnection {
    testNormalization(options: WebsocketConnectionOptions) {
        return this.normalize_endpoint(options);
    }

    getEndpoint(): string {
        return this.endpoint;
    }
}

const options: WebsocketConnectionOptions = {
    host: "localhost:3002",
    apiKey: "some_strong_api_key1",
    apiHost: "localhost:5000",
    channels: ["ticker3", "iss", "iss2", "ticks", "yahoo1"],
};

describe('websocket', () => {
    it('normalize_endpoint works on dev', () => {
        const to = {...options, env: 'dev'} as WebsocketConnectionOptions;
        const tt = new TestWebsocket(to);
        expect(tt.testNormalization(to)).toEqual("ws://localhost:3002/ws?api_key=some_strong_api_key1&host=localhost:5000&channels=ticker3,iss,iss2,ticks,yahoo1");
    });
    it('normalize_endpoint works on prod', () => {
        const to = {...options, env: 'prod'} as WebsocketConnectionOptions;
        const tt = new TestWebsocket(to);
        expect(tt.testNormalization(to)).toEqual("wss://localhost:3002/ws?api_key=some_strong_api_key1&host=localhost:5000&channels=ticker3,iss,iss2,ticks,yahoo1");
    });
    it('endpoint is generated correctly', () => {
        const tt = new TestWebsocket(options);
        expect(tt.getEndpoint()).toEqual("wss://localhost:3002/ws?api_key=some_strong_api_key1&host=localhost:5000&channels=ticker3,iss,iss2,ticks,yahoo1");
    });
});
