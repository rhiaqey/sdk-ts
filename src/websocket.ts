import { WebSocketSubjectConfig, webSocket } from 'rxjs/webSocket';
import { ClientMessage } from './message';
import { ulid } from 'ulidx';
import {Observable, Subject, filter, map, retryWhen, throwError, timer} from 'rxjs';

import { plainToInstance } from 'class-transformer';
import {mergeMap} from "rxjs/operators";

if (typeof process !== 'undefined' && process.release.name === 'node') {
    Object.assign(global, { WebSocket: require('ws') });
}

export type WebsocketConnectionOptions = {
    endpoint: string;
    apiKey: string;
    apiHost: string;
    channels: string | string[];
    snapshot?: boolean;
    env?: 'dev' | 'prod'
};

export type WebsocketConnectParams = {
    maxRetryAttempts: number;
    pingTimeout: number;
    retryTimeout: number;
};

const DEFAULT_WEBSOCKET_CONNECT_PARAMS: WebsocketConnectParams = {
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

const genericRetryStrategy =
    ({
         maxRetryAttempts = 3,
         retryTimeout = 1000,
     }: {
        maxRetryAttempts?: number;
        retryTimeout?: number;
    } = {}) =>
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        (attempts: Observable<any>) => {
            return attempts.pipe(
                mergeMap((error, i) => {
                    const retryAttempt = i + 1;

                    if (retryAttempt > maxRetryAttempts) {
                        return throwError(() => error);
                    }

                    return timer(retryAttempt * retryTimeout);
                }),
            );
        };

export class WebsocketConnection {
    public id: string;

    protected endpoint!: string;
    protected channels!: Set<string>;
    protected events = new Subject<WebsocketConnectionEvent>();

    protected normalize_endpoint(options: WebsocketConnectionOptions): string {
        let endpoint = options.env === 'dev' ? 'ws://' : 'wss://';

        // extract host
        if (options.endpoint.startsWith('http://')) {
            endpoint += options.endpoint.substring(8);
        } else if (options.endpoint.startsWith('https://')) {
            endpoint += options.endpoint.substring(7);
        } else if (options.endpoint.startsWith('wss://')) {
            endpoint += options.endpoint.substring(6);
        } else if (options.endpoint.startsWith('ws://')) {
            endpoint += options.endpoint.substring(5);
        } else {
            endpoint += options.endpoint;
        }

        // ensure suffix is correct
        if (!endpoint.endsWith('/ws')) {
            endpoint += '/ws'
        }

        // pass api details directly
        endpoint += `?api_key=${options.apiKey}`;
        endpoint += `&api_host=${options.apiHost}`;

        // normalize channels
        const channels =
            !options.channels ? '' :
                typeof options.channels === 'string' ? options.channels : options.channels.join(',');
        endpoint += `&channels=${channels}`;

        if (typeof options.snapshot !== 'undefined') {
            endpoint += `&snapshot=${options.snapshot}`;
        } else {
            endpoint += '&snapshot=true';
        }

        return endpoint;
    }

    constructor(public options: WebsocketConnectionOptions) {
        this.id = ulid();
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
            map<WebsocketConnectionEvent, ClientMessage<T>>(([, data]: WebsocketConnectionEvent) => {
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
