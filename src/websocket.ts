import { type WebSocketSubjectConfig, webSocket, type WebSocketSubject } from 'rxjs/webSocket';
import { ClientMessage } from './message';
import { ulid } from 'ulidx';
import { type Observable, Subject, filter, map, throwError, timer, of, type Subscription, firstValueFrom } from 'rxjs';
import { fromFetch } from 'rxjs/fetch';

import { plainToInstance } from 'class-transformer';
import { retry, switchMap } from 'rxjs/operators';

if (typeof process !== 'undefined' && process.release.name === 'node') {
    Object.assign(global, { WebSocket: require('ws') });
}

export type WebsocketConnectionOptions = {
    endpoints: string | string[];
    apiKey: string;
    apiHost: string;
    channels: string | string[];
    snapshot?: 'asc' | 'desc' | boolean;
    snapshot_size?: number;
    user_id?: string;
    env?: 'dev' | 'prod';
};

export type WebsocketConnectParams = {
    maxRetryAttempts: number;
    pingTimeout: number;
    retryTimeout: number;
};

const DEFAULT_WEBSOCKET_CONNECT_PARAMS: WebsocketConnectParams = {
    maxRetryAttempts: Number.POSITIVE_INFINITY,
    pingTimeout: 2000,
    retryTimeout: 2000,
};

export type WebsocketConnectionEvent<D = unknown> =
    | [event: 'ready']
    | [event: 'open', data: Event]
    | [event: 'close', data: CloseEvent]
    | [event: 'error', data: Error]
    | [event: 'data', data: ClientMessage<D>]
    | [event: 'complete'];

export class WebsocketConnection {
    protected $id: string; // uniq connection id. does not change

    protected $channels!: Set<string>; // normalized channels
    protected $ws_endpoints!: Array<string>; // normalized websocket endpoints
    protected $snapshot_endpoints!: Array<string>; // normalized snapshot endpoints

    protected $connection_index = 0;
    protected $connection_subscription: Subscription;
    protected $connection_params = DEFAULT_WEBSOCKET_CONNECT_PARAMS; // default connection parameters
    protected $connection: WebSocketSubject<ClientMessage<unknown>>; // active connection

    protected $events = new Subject<WebsocketConnectionEvent>(); // event stream

    protected normalize_endpoints(options: WebsocketConnectionOptions, protocol: string, path_suffix = '/ws'): Array<string> {
        const endpoints = (Array.isArray(options.endpoints) ? options.endpoints : options.endpoints.split(',')).map(value => value.trim());

        const result = new Set<string>();

        for (const endpoint of endpoints) {
            let output = protocol;

            // extract host
            if (endpoint.startsWith('http://')) {
                output += endpoint.substring(8);
            } else if (endpoint.startsWith('https://')) {
                output += endpoint.substring(7);
            } else if (endpoint.startsWith('wss://')) {
                output += endpoint.substring(6);
            } else if (endpoint.startsWith('ws://')) {
                output += endpoint.substring(5);
            } else {
                output += endpoint;
            }

            // ensure suffix is correct
            if (!output.endsWith(path_suffix)) {
                output += path_suffix;
            }

            // pass api details directly
            output += `?api_key=${options.apiKey}`;
            output += `&api_host=${options.apiHost}`;

            // channels are already normalized
            output += `&channels=${Array.from(this.$channels)
                .map(channel => encodeURIComponent(channel))
                .join(',')}`;

            if (typeof options.snapshot !== 'undefined') {
                output += `&snapshot=${options.snapshot}`;
            } else {
                output += '&snapshot=true';
            }

            if (typeof options.snapshot_size !== 'undefined') {
                output += `&snapshot_size=${+options.snapshot_size}`;
            }

            if (typeof options.user_id !== 'undefined') {
                output += `&user_id=${encodeURIComponent(options.user_id)}`;
            }

            result.add(output);
        }

        return Array.from(result);
    }

    protected normalize_channels(channels: string | string[]): Set<string> {
        if (Array.isArray(channels)) {
            return new Set(channels.map(channel => channel.trim()));
        }

        return new Set(channels.split(',').map(channel => channel.trim()));
    }

    constructor(
        public options: WebsocketConnectionOptions,
        public connection_params = DEFAULT_WEBSOCKET_CONNECT_PARAMS,
    ) {
        this.$id = ulid();
        this.$connection_params = connection_params;
        this.$channels = this.normalize_channels(options.channels);
        this.$ws_endpoints = this.normalize_endpoints(options, options.env === 'dev' ? 'ws://' : 'wss://', '/ws');
        this.$snapshot_endpoints = this.normalize_endpoints(options, options.env === 'dev' ? 'http://' : 'https://', '/snapshot');
        this.$events.next(['ready']);
    }

    protected generateWebSocketEndpoint(): string {
        let endpoint = this.$ws_endpoints[this.$connection_index++ % this.$ws_endpoints.length];
        endpoint += `&_=${Date.now()}`;
        return endpoint;
    }

    protected create_connection() {
        const options: WebSocketSubjectConfig<ClientMessage<unknown>> = {
            url: this.generateWebSocketEndpoint(),
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
                return plainToInstance(ClientMessage<unknown>, JSON.parse(new TextDecoder().decode(msg.data)));
            },
        };

        return webSocket(options);
    }

    protected subscribe_to_connection() {
        this.$connection_subscription = this.$connection
            .pipe(
                retry({
                    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
                    delay: (error: any, retryCount: number) => {
                        if (retryCount > this.connection_params.retryTimeout) {
                            return throwError(() => error);
                        }

                        if (this.$ws_endpoints.length > 1) {
                            this.connect();
                        }

                        return timer(retryCount * this.connection_params.retryTimeout);
                    },
                    resetOnSuccess: true,
                }),
            )
            .subscribe({
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

    connect() {
        if (this.$connection_subscription) {
            this.$connection_subscription.unsubscribe();
        }
        this.$connection = this.create_connection();
        this.subscribe_to_connection();
    }

    eventStream(): Observable<WebsocketConnectionEvent> {
        return this.$events.asObservable();
    }

    dataStream<T = unknown>(): Observable<ClientMessage<T>> {
        return this.eventStream().pipe(
            filter(message => message[0] === 'data'),
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            map<WebsocketConnectionEvent, ClientMessage<T>>(([, data]: WebsocketConnectionEvent) => {
                return data as ClientMessage<T>;
            }),
        );
    }

    channelStream<T = unknown>(channel: string): Observable<ClientMessage<T>> {
        return this.dataStream<T>().pipe(filter(data => channel.startsWith(data.get_channel())));
    }

    protected generateSnapshotEndpoint(): string {
        let endpoint = this.$snapshot_endpoints[this.$connection_index % this.$snapshot_endpoints.length];
        endpoint += `&_=${Date.now()}`;
        return endpoint;
    }

    fetchSnapshot<T = unknown>(): Observable<T> {
        return fromFetch(this.generateSnapshotEndpoint()).pipe(
            switchMap(response => {
                if (response.ok) {
                    // OK return data
                    return response.json();
                    // biome-ignore lint/style/noUselessElse: <explanation>
                } else {
                    // Server is returning a status requiring the client to try something else.
                    return of({ error: true, message: `Error ${response.status}`, response });
                }
            }),
        );
    }

    async fetchSnapshotPromised<T = unknown>(): Promise<T> {
        return firstValueFrom(this.fetchSnapshot<T>());
    }

    close() {
        this.$connection.complete();
    }

    // TODO: Remove me. Must be used only for debugging purposes
    // The close code must be either 1000, or between 3000 and 4999.
    /*
    closeWithError(reason: string) {
        this.$connection.error({ reason });
    }*/

    getChannels(): Set<string> {
        return this.$channels;
    }

    getId(): string {
        return this.$id;
    }
}
