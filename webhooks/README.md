# Webhooks

Based on https://github.com/github/docs/blob/main/src/rest/README.md, this script pulls the updated OpenAPI webhook schemas from https://github.com/github/rest-api-description/blob/main/descriptions/api.github.com/dereferenced/api.github.com.deref.json and generates a `webhooks.json` file for consumption by the language service, preserving any descriptions and summaries as markdown.

## Usage

```shell
npm start 
```
