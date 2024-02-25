export enum ClientMessageType {
    Connected = 0,
    Subscribed = 1,
    Data = 10,
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
    }
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
}
