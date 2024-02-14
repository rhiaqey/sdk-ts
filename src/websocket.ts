import { WebSocketSubjectConfig, webSocket } from 'rxjs/webSocket';
import { ClientMessage } from './message';
import { Observable, Subject, filter, map, retryWhen } from 'rxjs';
import { genericRetryStrategy } from './retry';

import { plainToInstance } from 'class-transformer';

if (typeof process !== 'undefined' && process.release.name === 'node') {
    Object.assign(global, { WebSocket: require('ws') });
}

export type WebsocketConnectionOptions = {
    host: string;
    apiKey: string;
    channels: string[];
    env?: 'dev' | 'prod'
};

export type WebsocketConnectParams = {
    maxRetryAttempts: number;
    pingTimeout: number;
    retryTimeout: number;
};

const DEFAULT_WEBSOCKET_CONNECT_PARAMS = {
    maxRetryAttempts: Infinity,
    pingTimeout: 30000,
    retryTimeout: 10000,
}

export type WebsocketConnectionEvent<D = unknown> = 
    [ event: 'ready' ] |
    [ event: 'open',  data: Event ] |
    [ event: 'close', data: CloseEvent ] |
    [ event: 'error', data: Error ] |
    [ event: 'data',  data: ClientMessage<D> ] |
    [ event: 'complete' ];

export class WebsocketConnection {

    protected endpoint!: string;
    protected channels!: Set<string>;
    protected events = new Subject<WebsocketConnectionEvent>();

    protected normalize_endpoint(options: WebsocketConnectionOptions): string {
        let endpoint = options.env === 'dev' ? 'ws://' : 'wss://';
        
        if (options.host.startsWith('http://')) {
            endpoint += options.host.substring(8);
        } else if (options.host.startsWith('https://')) {
            endpoint += options.host.substring(7);
        } else if (options.host.startsWith('wss://')) {
            endpoint += options.host.substring(6);
        } else if (options.host.startsWith('ws://')) {
            endpoint += options.host.substring(5);
        } else {
            endpoint += options.host;
        }

        if (!endpoint.endsWith('/ws')) {
            endpoint += '/ws'
        }

        endpoint += `?api_key=${options.apiKey}`;
        endpoint += `&channels=${options.channels.join(',')}`;

        return endpoint;
    }

    constructor(public options: WebsocketConnectionOptions) {
        this.endpoint = this.normalize_endpoint(options);
        this.channels = new Set(options.channels);
        this.events.next([ 'ready' ]);
    }

    connect(connectParams = DEFAULT_WEBSOCKET_CONNECT_PARAMS) {
        const options: WebSocketSubjectConfig<ClientMessage<unknown>> = {
            url: this.endpoint,
            binaryType: 'arraybuffer',
            openObserver: {
                next: (event: Event) => {
                    this.events.next([ 'open', event ]);
                },
            },
            closeObserver: {
                next: (event: CloseEvent) => {
                    this.events.next([ 'close', event ]);
                },
            },
            serializer: (value: ClientMessage<unknown>) => {
                return new TextEncoder().encode(JSON.stringify(value));
            },
            deserializer: (msg: MessageEvent<ArrayBuffer>): ClientMessage<unknown> => {
                return plainToInstance(
                    // eslint-disable-next-line prettier/prettier
                    ClientMessage<unknown>,
                    JSON.parse(new TextDecoder().decode(msg.data))
                );
            }
        };

        const subject = webSocket(options);

        return subject.pipe(
            retryWhen(
                genericRetryStrategy({
                    maxRetryAttempts: connectParams.maxRetryAttempts,
                    retryTimeout: connectParams.retryTimeout,
                }),
            ),
        ).subscribe({
            next: data => {
                this.events.next([ 'data', data ]);
            },
            error: err => {
                this.events.next([ 'error', err ]);
            },
            complete: () => {
                this.events.next([ 'complete' ]);
            },
        });
    }

    eventStream(): Observable<WebsocketConnectionEvent> {
        return this.events.asObservable()
    }

    dataStream<T = unknown>(): Observable<ClientMessage<T>> {
        return this.eventStream().pipe(
            filter((message) => message[0] === 'data'),
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            map<WebsocketConnectionEvent, ClientMessage<T>>(([_, data]: WebsocketConnectionEvent) => {
                return data as ClientMessage<T>;
            }),
        );
    }

    channelStream<T = unknown>(channel: string): Observable<ClientMessage<T>> {
        return this.dataStream<T>().pipe(
            filter((data) => data.get_channel() === channel),
        );
    }

}
