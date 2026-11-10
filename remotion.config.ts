// Render settings for every `npx remotion` command in this project.
import { existsSync, readdirSync } from 'node:fs';
import { Config } from '@remotion/cli/config';

// Use a pre-installed Chromium headless shell when the machine has one
// (cloud sandboxes often block Remotion's own browser download).
const sandboxBrowser = (): string | null => {
  const root = '/opt/pw-browsers';
  if (!existsSync(root)) return null;
  const names = ['chrome-headless-shell-linux64/chrome-headless-shell', 'chrome-linux/headless_shell'];
  return (
    readdirSync(root)
      .filter((d) => d.startsWith('chromium_headless_shell-'))
      .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]))
      .flatMap((d) => names.map((n) => `${root}/${d}/${n}`))
      .find((p) => existsSync(p)) ?? null
  );
};
const browser = process.env.REMOTION_BROWSER || sandboxBrowser();
if (browser) Config.setBrowserExecutable(browser);

Config.setVideoImageFormat('png'); // lossless frames: the flat cream must stay one exact colour
Config.setColorSpace('bt709');
Config.setPixelFormat('yuv420p');
Config.setCodec('h264');
Config.setCrf(14);
Config.setOverwriteOutput(true);
