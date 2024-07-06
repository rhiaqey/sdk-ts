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
    protected typ!: ClientMessageType;      // a.k.a    d
    protected chn!: string;                 // a.k.a    c
    protected key!: string;                 // a.k.a    k
    protected val!: T;                      // a.k.a    v
    // optional
    protected tag?: string;                 // a.k.a    t
    protected cat?: string;                 // a.k.a    g
    protected hid?: string;                 // a.k.a    h
    protected pid?: string;                 // a.k.a    p

    // smaller alternatives

    // required
    protected d!: ClientMessageType;        // a.k.a    typ
    protected c!: string;                   // a.k.a    chn
    protected k!: string;                   // a.k.a    key
    protected v!: T;                        // a.k.a    val
    // optional
    protected t?: string;                   // a.k.a    tag
    protected g?: string;                   // a.k.a    cat
    protected h?: string;                   // a.k.a    hid
    protected p?: string;                   // a.k.a    pid

    get_type(): ClientMessageType {
        return this.typ || this.d;
    }

    get_channel(): string {
        return this.chn || this.c;
    }

    get_key(): string {
        return this.key || this.k;
    }

    get_value(): T {
        return this.val || this.v;
    }

    get_channel_parts(): [ string, string?, string? ] {
        const parts = this.get_channel().split("/");

        if (parts.length === 3) 
            return [ parts[0], parts[1], parts[2] ];

        if (parts.length === 2)
            return [ parts[0], parts[1], undefined ];

        if (parts.length === 1)
            return [ parts[0], undefined, undefined ];

        return [ undefined, undefined, undefined ];
    }

    get_tag(): string | undefined {
        return this.tag || this.t;
    }

    get_category(): string | undefined {
        return this.cat || this.g;
    }

    has_tag(): boolean {
        return !!this.get_tag();
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
