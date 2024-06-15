import { plainToInstance } from 'class-transformer';
import { ClientMessage } from '../message';

const RAW_CONNECTED_MESSAGE = '{"typ":0,"chn":"","key":"","val":{"client_id":"hello","hub_id":"hub_id_123"}}';

const RAW_SUBSCRIBED_MESSAGE = '{"typ":1,"chn":"iss2","key":"iss2","val":{"channel":{"Name":"iss2","Size":5}}}';

describe('message', () => {
    it('deserialization should work with client connected', () => {
        const raw = JSON.parse(RAW_CONNECTED_MESSAGE);
        const clientMessage = plainToInstance(
            ClientMessage<{
                client_id: string;
                hub_id: string;
            }>,
            raw,
        );
        expect(raw).toBeDefined();
        expect(clientMessage).toBeDefined();
        expect(clientMessage.get_value()).toBeDefined();
        expect(clientMessage.get_value().client_id).toEqual('hello');
        expect(clientMessage.get_value().hub_id).toEqual('hub_id_123');
    });

    it('deserialization should work with client subscribed', () => {
        const raw = JSON.parse(RAW_SUBSCRIBED_MESSAGE);
        const clientMessage = plainToInstance(
            ClientMessage<{
                channel: {
                    Name: string;
                    Size: 5;
                };
            }>,
            raw,
        );
        expect(raw).toBeDefined();
        expect(clientMessage).toBeDefined();
        expect(clientMessage.get_value()).toBeDefined();
        expect(clientMessage.get_value().channel.Name).toEqual('iss2');
        expect(clientMessage.get_value().channel.Size).toEqual(5);
        expect(clientMessage.get_value().channel.Name).toEqual(clientMessage.get_channel());
    });
});
