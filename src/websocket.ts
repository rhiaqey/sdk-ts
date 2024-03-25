import { type WebSocketSubjectConfig, webSocket, type WebSocketSubject } from 'rxjs/webSocket';
import { ClientMessage } from './message';
import { ulid } from 'ulidx';
import { type Observable, Subject, filter, map, retryWhen, throwError, timer, of } from 'rxjs';
import { fromFetch } from 'rxjs/fetch';

import { plainToInstance } from 'class-transformer';
import { mergeMap, switchMap } from "rxjs/operators";

if (typeof process !== 'undefined' && process.release.name === 'node') {
    Object.assign(global, { WebSocket: require('ws') });
}

export type WebsocketConnectionOptions = {
    endpoint: string;
    apiKey: string;
    apiHost: string;
    channels: string | string[] | Set<string>;
    snapshot?: boolean;
    env?: 'dev' | 'prod'
};

export type WebsocketConnectParams = {
    maxRetryAttempts: number;
    pingTimeout: number;
    retryTimeout: number;
};

const DEFAULT_WEBSOCKET_CONNECT_PARAMS: WebsocketConnectParams = {
    maxRetryAttempts: Number.POSITIVE_INFINITY,
    pingTimeout: 30000,
    retryTimeout: 10000,
}

export type WebsocketConnectionEvent<D = unknown> =
    [event: 'ready'] |
    [event: 'open', data: Event] |
    [event: 'close', data: CloseEvent] |
    [event: 'error', data: Error] |
    [event: 'data', data: ClientMessage<D>] |
    [event: 'complete'];

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
    protected $id: string;
    protected $ws_endpoint!: string;
    protected $snapshot_endpoint!: string;
    protected $channels!: Set<string>;
    protected $events = new Subject<WebsocketConnectionEvent>();
    protected $connection: WebSocketSubject<ClientMessage<unknown>>;

    protected normalize_snapshot_endpoint(options: WebsocketConnectionOptions): string {
        let endpoint = options.env === 'dev' ? 'http://' : 'https://';

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
        if (!endpoint.endsWith('/snapshot')) {
            endpoint += '/snapshot'
        }

        // pass api details directly
        endpoint += `?api_key=${options.apiKey}`;
        endpoint += `&api_host=${options.apiHost}`;

        // channels are already normalized
        endpoint += `&channels=${Array.from(this.$channels).join(',')}`;

        if (typeof options.snapshot !== 'undefined') {
            endpoint += `&snapshot=${options.snapshot}`;
        } else {
            endpoint += '&snapshot=true';
        }

        return endpoint;
    }

    protected normalize_ws_endpoint(options: WebsocketConnectionOptions): string {
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

        // channels are already normalized
        endpoint += `&channels=${Array.from(this.$channels).join(',')}`;

        if (typeof options.snapshot !== 'undefined') {
            endpoint += `&snapshot=${options.snapshot}`;
        } else {
            endpoint += '&snapshot=true';
        }

        return endpoint;
    }

    protected normalize_channels(channels: string | string[] | Set<string>): Set<string> {
        if (channels instanceof Set) {
            return channels;
        }

        if (Array.isArray(channels)) {
            return new Set(channels.map(channel => channel.trim()));
        }

        return new Set(channels.split(',').map(channel => channel.trim()));
    }

    constructor(public options: WebsocketConnectionOptions) {
        this.$id = ulid();
        this.$channels = this.normalize_channels(options.channels);
        this.$ws_endpoint = this.normalize_ws_endpoint(options);
        this.$snapshot_endpoint = this.normalize_snapshot_endpoint(options);
        this.$events.next(['ready']);
    }

    connect(connectParams = DEFAULT_WEBSOCKET_CONNECT_PARAMS) {
        const options: WebSocketSubjectConfig<ClientMessage<unknown>> = {
            url: this.$ws_endpoint,
            binaryType: 'arraybuffer',
            openObserver: {
                next: (event: Event) => {
                    this.$events.next(['open', event]);
                },
            },
            closeObserver: {
                next: (event: CloseEvent) => {
                    this.$events.next(['close', event]);
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

        this.$connection = webSocket(options);

        this.$connection.pipe(
            retryWhen(
                genericRetryStrategy({
                    maxRetryAttempts: connectParams.maxRetryAttempts,
                    retryTimeout: connectParams.retryTimeout,
                }),
            ),
        ).subscribe({
            next: data => {
                this.$events.next(['data', data]);
            },
            error: err => {
                this.$events.next(['error', err]);
            },
            complete: () => {
                this.$events.next(['complete']);
            },
        });
    }

    eventStream(): Observable<WebsocketConnectionEvent> {
        return this.$events.asObservable()
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

    fetchSnapshot<T = unknown>(): Observable<T> {
        return fromFetch(this.$snapshot_endpoint).pipe(
            switchMap(response => {
                if (response.ok) {
                    // OK return data
                    return response.json();
                    // biome-ignore lint/style/noUselessElse: <explanation>
                } else {
                    // Server is returning a status requiring the client to try something else.
                    return of({ error: true, message: `Error ${ response.status }`, response });
                }
            })
        );
    }

    disconnect() {
        this.$connection.complete();
    }

    getChannels(): Set<string> {
        return this.$channels;
    }

    getId(): string {
        return this.$id;
    }

}
