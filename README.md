# RhiaqeySDK

## NPM

```
https://www.npmjs.com/package/@rhiaqey/sdk-ts
```

## CDN

```
https://cdn.jsdelivr.net/npm/@rhiaqey/sdk-ts@1.0.4/build/sdk.js
https://cdn.jsdelivr.net/npm/@rhiaqey/sdk-ts@1.0/build/sdk.js
https://cdn.jsdelivr.net/npm/@rhiaqey/sdk-ts@1/build/sdk.js
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
