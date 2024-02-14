# RhiaqeySDK

## Example

```js
let connection = new RhiaqeySDK.WebsocketConnection({
    host: 'https://hub.demo.prod.cloud.rhiaqey.com',
    channels: [ 'some_channel' ],
    apiKey: 'strong_api_key'
});

connection.connect();
```
