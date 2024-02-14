# RhiaqeySDK

## NPM

```
https://www.npmjs.com/package/@rhiaqey/sdk-ts
```

## CDN

```
https://cdn.jsdelivr.net/npm/@rhiaqey/sdk-ts@1.0.6/dist/sdk.js
https://cdn.jsdelivr.net/npm/@rhiaqey/sdk-ts@1.0/dist/sdk.js
https://cdn.jsdelivr.net/npm/@rhiaqey/sdk-ts@1/dist/sdk.js
```

## Example

```js
let connection = new RhiaqeySDK.WebsocketConnection({
    host: 'https://hub.demo.prod.cloud.rhiaqey.com',
    channels: [ 'some_channel' ],
    apiKey: 'strong_api_key'
});

connection.connect();
```
