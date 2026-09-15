const fs = require('node:fs');
const path = require('node:path');
module.exports = (evidenceFile, scope, hook) => {
  const evidence = JSON.parse(fs.readFileSync(evidenceFile, 'utf8'));
  const event = { scope, hook };
  evidence.events.push(event);
  fs.writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2) + '\n');
  console.log('SEC_TEST_INSTALL_CODE_EXECUTED ' + JSON.stringify(event));
};
