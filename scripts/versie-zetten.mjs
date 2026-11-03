// Zet het versienummer voor een build: major.minor uit package.json, patch = buildnummer.
// Gebruik: node scripts/versie-zetten.mjs <buildnummer>
// Werkt package.json (en daarmee de manifestversie "*") en config/package-solution.json bij
// en schrijft de nieuwe versie naar stdout.
import { readFileSync, writeFileSync } from 'node:fs';

const build = Number(process.argv[2]);
if (!Number.isInteger(build) || build < 0 || build > 65535) {
  console.error('Geef een geldig buildnummer (0-65535) op.');
  process.exit(1);
}

const lees = (pad) => JSON.parse(readFileSync(pad, 'utf8'));
const schrijf = (pad, data) => writeFileSync(pad, JSON.stringify(data, null, 2) + '\n');

const pkg = lees('package.json');
const [major, minor] = pkg.version.split('.').map(Number);
const versie = `${major}.${minor}.${build}`;
const solutionVersie = `${versie}.0`;

pkg.version = versie;
schrijf('package.json', pkg);

const solution = lees('config/package-solution.json');
solution.solution.version = solutionVersie;
for (const feature of solution.solution.features ?? []) {
  feature.version = solutionVersie;
}
schrijf('config/package-solution.json', solution);

console.log(versie);
