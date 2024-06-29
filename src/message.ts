export enum ClientMessageType {
    // eslint-disable-next-line no-unused-vars
    Connected = 0,
    // eslint-disable-next-line no-unused-vars
    Subscribed = 1,
    // eslint-disable-next-line no-unused-vars
    Data = 10,
    // eslint-disable-next-line no-unused-vars
    Ping = 100,
}

export type ClientConnectedMessage = {
    client_id: string;
    hub_id?: string;
};

export type ClientSubscribedMessage = {
    channel: {
        Name: string;
        Size: number;
    };
};

export class ClientMessage<T = unknown> {
    // required
    protected typ!: ClientMessageType;
    protected chn!: string;
    protected key!: string;
    protected val!: T;
    // optional
    protected tag?: string;
    protected cat?: string;

    get_type(): ClientMessageType {
        return this.typ;
    }

    get_channel(): string {
        return this.chn;
    }

    get_channel_parts(): [ string, string?, string? ] {
        const parts = this.chn.split("/");

        if (parts.length === 3) 
            return [ parts[0], parts[1], parts[2] ];

        if (parts.length === 2)
            return [ parts[0], parts[1], undefined ];

        if (parts.length === 1)
            return [ parts[0], undefined, undefined ];

        return [ undefined, undefined, undefined ];
    }

    get_key(): string {
        return this.key;
    }

    get_value(): T {
        return this.val;
    }

    has_tag(): boolean {
        return !!this.tag;
    }

    get_tag(): string | undefined {
        return this.tag;
    }

    get_category(): string | undefined {
        return this.cat;
    }

    is_connected_type(): boolean {
        return this.get_type() === ClientMessageType.Connected;
    }

    is_subscribed_type(): boolean {
        return this.get_type() === ClientMessageType.Subscribed;
    }

    is_data_type(): boolean {
        return this.get_type() === ClientMessageType.Data;
    }

    is_ping_type(): boolean {
        return this.get_type() === ClientMessageType.Ping;
    }
}
