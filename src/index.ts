/**
 * Node entry point. Registers the Node platform (@napi-rs/canvas + filesystem)
 * and re-exports the shared API. This file pulls in the native canvas addon, so
 * it must NOT be used by browser bundlers — they resolve the "browser" export
 * condition to ./index.browser instead.
 */
import { setPlatform } from './platform';
import { nodePlatform } from './platform/node';

setPlatform(nodePlatform);

export * from './core';
