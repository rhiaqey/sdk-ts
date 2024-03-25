# RhiaqeySDK

![sdk-ts](https://github.com/rhiaqey/sdk-ts/actions/workflows/pr_merge.yml/badge.svg)

## NPM

```
https://www.npmjs.com/package/@rhiaqey/sdk-ts
```

## CDN

```
https://cdn.jsdelivr.net/npm/@rhiaqey/sdk-ts@1.0.45/dist/umd/sdk.js
https://cdn.jsdelivr.net/npm/@rhiaqey/sdk-ts@1.0/dist/umd/sdk.js
https://cdn.jsdelivr.net/npm/@rhiaqey/sdk-ts@1/dist/umd/sdk.js
```

## Example

```js
let connection = new RhiaqeySDK.WebsocketConnection({
    endpoints: [
        'https://hub.demo.prod.cloud.rhiaqey.com'
    ],
    channels: [
        'some_channel'
    ],
    apiKey: 'strong_api_key',
    apiHost: 'localhost:3333',
    snapshot: true  // subscribe to snapshot feed
});

// request snapshot from /snapshot http endpoint
connection.fetchSnapshot().subscribe(data => {
    console.log('>> snapshot arrived', data);
});

// promised version of the snapshot request
connection.fetchSnapshotPromised().then(data => {
    console.log('>> async snapshot arrived', data);
});

// all the messages will land here
connection.dataStream().subscribe((message) => {
    // console.log('>> message arrived', message);
});

// connect explicitly
connection.connect();

```
