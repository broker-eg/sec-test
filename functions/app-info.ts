import { reply } from './_app.cjs';
export default function (_req: unknown, res: any): void {
  reply(res, 'app-info', {
    node: process.version,
    arch: process.arch,
    installed: {
      axios: require('axios/package.json').version,
      dayjs: require('dayjs/package.json').version,
      lodash: require('lodash/package.json').version,
      uuid: require('uuid/package.json').version,
      zod: require('zod/package.json').version,
      express: require('express/package.json').version,
    },
  });
}
