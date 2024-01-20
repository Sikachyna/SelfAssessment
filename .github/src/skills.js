'use strict';

const fs = require('node:fs').promises;
const path = require('node:path');
const cp = require('node:child_process');
const metautil = require('metautil');
const concolor = require('concolor');

const TITLE = 'Software engineering self assessment';
const PARSING_TIMEOUT = 1000;
const EXECUTION_TIMEOUT = 5000;

const PATH = path.join(process.cwd(), '../..');

const OUT = cp.execSync('git config --get remote.origin.url').toString();
const REPO = metautil.between(OUT, ':', '.');
const LINK = 'https://github.com/' + REPO;

const BASE = 'https://img.shields.io/badge/Self_Assessment-skills-009933';
const STYLE = `style=flat-square`;
const BADGE = `[![Skills](${BASE}?${STYLE})](${LINK})`;

let exitCode = 0;

const fatal = concolor('b,white/red');
const fixup = concolor('b,black/yellow');

const wrongFormat = (msg, file) => {
  exitCode = 1;
  console.log(fatal` Wrong file format: ${msg} `);
  console.log(`File: ${file}`);
};

const warnFixup = (msg, file) => {
  console.log(fixup` Fixup file format: ${msg} `);
  console.log(`File: ${file}`);
};

const codeBlock = (code) => '```\n' + code + '\n```';

const loadFile = async (file) => {
  const fileName = path.join(PATH, file);
  const data = await fs.readFile(fileName, 'utf8');
  if (data.includes('\r')) {
    warnFixup('expected LF linebreaks, not CRLF or CR', file);
  }
  if (!data.startsWith('## ')) {
    wrongFormat('no markdown «## Heading»', file);
  }
  if (!data.endsWith('\n')) {
    warnFixup('no newline at the end of file', file);
  }
  return data;
};

const LEVEL = [
  'heard',
  'known',
  'used',
  'explained',
  'talked',
  'researched',
  'constructed',
];

const EMOJI = ['👂', '🎓', '🖐️', '🙋', '📢', '🔬', '🚀'];

const LEVEL_EMOJI = Object.fromEntries(LEVEL.map((n, i) => [n, EMOJI[i]]));

//console.log({ LEVEL, EMOJI, LEVEL_EMOJI });

const getSkills = (data, file) => {
  const lines = data.split('\n');
  if (lines.at(-1).trim() === '') lines.pop();
  let section = '';
  let empty = 0;
  const out = [];
  const skills = [];
  for (const [i, s] of lines.entries()) {
    const line = s.trim();
    if (line === '') {
      if ((!section && empty > 0) || (section)) {
        warnFixup(`removed empty line at line ${i + 1}`, file);
      } else {
        out.push(line);
      }
      empty++;
      continue;
    }
    empty = 0;
    if (s.startsWith('##')) {
      out.push(line);
      continue;
    }
    if (s.startsWith('-')) {
      out.push(line);
      section = line.slice(1).trim();
      continue;
    }
    if (s.startsWith('  -')) {
      const skill = line.slice('  -'.length - 1).trim();
      if (skills.includes(skill)) {
        warnFixup(`removed duplicate skill «${skill}» at line ${i + 1}`, file);
      } else {
        out.push('  - ' + skill);
        skills.push(skill);
      }
      continue;
    }
    wrongFormat(`unkonw structure at line ${i + 1}`, file);
  }
  const output = out.join('\n') + '\n';
  if (data !== output) {
    const fileName = path.join(PATH, file);
    fs.writeFile(fileName, output).catch(() => {});
    console.log(`Fixup: ${data.length} -> ${output.length} saved: ${file}`);
  }
  return skills;
};

const analise = async (section) => {
  const file = `Skills/${section}.md`;
  const md = await loadFile(file);
  const skills = getSkills(md, file);
  console.log(concolor.info(`Skills: ${skills.length}`));
  return;
};

(async () => {
  console.log(concolor.white(TITLE));
  console.log(concolor.info('Auto Checker'));

  const files = await fs.readdir(`${PATH}/Skills/`);
  const sections = files
    .filter((file) => file.endsWith('.md'))
    .map((file) => file.substring(0, file.length - '.md'.length));
  for (const section of sections) {
    console.log(concolor`\nCheck: ${section}(b,white)`);
    await analise(section);
  }

  const badgeCode = codeBlock(BADGE);

  const report = `## ${TITLE}\n\n${BADGE}\n\n${badgeCode}\n`;
  await fs.writeFile(`${PATH}/Profile/REPORT.md`, report);

  const readme = await loadFile('.github/src/Templates/README.md');
  const newReadme = readme.replace('$BADGE', BADGE);
  await fs.writeFile(`${PATH}/README.md`, newReadme);

  console.log('');
  process.exit(exitCode);
})();
