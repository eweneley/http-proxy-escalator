# http-proxy-escalator

This proxy escalates an unauthenticated proxy request to an authenticated proxy request.

For now, this proxy only supports HTTPS traffic.

## Installation

```
$ npm install
```

## Usage

```
$ export ESCALATOR_PORT=3101
$ export ESCALATOR_HTTPS_PROXY=http://<username>:<password>@<host>:<port>
$ npm start
```
