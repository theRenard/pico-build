import chokidar from 'chokidar';
import path from 'path';
import keypress from 'keypress';
import { spawn } from 'child_process';
import chalk from 'chalk';
import build from './build.mjs';
import { picoCmd, reloadCart } from './utils.mjs';
import * as logger from './log.mjs';
keypress(process.stdin);

let pico_process;
process.on('close', () => {
  pico_process.kill('SIGINT');
})

const runBuild = argv => {
  logger.clear();
  const stats = build(argv);
  logger.log(`Found ${chalk.magenta.bold(stats.numLuaFiles)} lua files:`);
  stats.luaFiles.forEach(file => {
    logger.log(`   • ${chalk.magenta(file.name)}`);
  });
  if (stats.outputFileExists) {
    logger.log(
      `\nCopied into:\n   ${path.dirname(stats.outputFile.path)}${
        path.sep
      }${chalk.yellow(stats.outputFile.name)}`
    );
  } else {
    logger.log(
      `\nCreated new cart:\n   ${path.dirname(stats.outputFile.path)}${
        path.sep
      }${chalk.yellow(stats.outputFile.name)}`
    );
  }
  const time = new Date().toLocaleTimeString();
  logger.render();

  if (pico_process) {
    reloadCart(argv.output);
  }
};

const openCart = argv => {
  let cmd = argv.executable || picoCmd();

  if (cmd) {
    if (pico_process) {
      pico_process.kill('SIGINT');
      pico_process = undefined;
    }

    pico_process = spawn(cmd, ['-run', argv.output]);
    pico_process.stdout.setEncoding('utf8');
    pico_process.stdout.on('data', chunk => {
      logger.log(`${chalk.cyan('PICO-8')} ->`, chunk);
    });

    pico_process.on('close', code => {
      logger.log('Closed with code:', code);
      pico_process = undefined;
    });
  }
};

export default function watch(argv) {
  // Run the initial build once
  runBuild(argv);

  // Construct the watcher
  const luaGlob = path.join(argv.input, '**.lua');
  const watcher = chokidar.watch(luaGlob, {});

  watcher.on('change', _ => runBuild(argv));
  watcher.on('add', _ => runBuild(argv));
  watcher.on('unlink', _ => runBuild(argv));

  process.stdin.on('keypress', (ch, key) => {
    if (key.sequence === '\u0003' || key.name === 'q') {
      process.exit();
    }

    switch (key.name) {
      case 'b':
        runBuild(argv);
        break;
      case 'o':
        openCart(argv);
        break;
      case 'x':
        pico_process.kill();
        break;
    }
  });
  process.stdin.setRawMode(true);
  process.stdin.resume();
}