# ClawXMemory Plugin

`openbmb-clawxmemory` is the OpenClaw `memory` plugin package published from the ClawXMemory repository.

It is responsible for:

- capturing conversations into `L0`
- building `L1` memory fragments when topics close
- updating `L2` project memory, `L2` daily timeline memory, and the singleton `GlobalProfileRecord`
- injecting memory context during `before_prompt_build`
- performing a best-effort session flush before `before_reset`
- serving the local memory dashboard

## Install

```bash
openclaw plugins install clawhub:openbmb-clawxmemory
```

If you want to install directly from npm for inspection or custom packaging workflows:

```bash
npm install openbmb-clawxmemory
```

On the first install, ClawXMemory may rewrite the managed OpenClaw memory settings and request one gateway restart automatically. Wait for that restart to finish before checking the dashboard or running `plugins inspect`.

After installation, it is recommended to verify the plugin status:

```bash
openclaw plugins inspect openbmb-clawxmemory --json
```

## Required Config

Make sure your OpenClaw config includes:

```json
{
  "plugins": {
    "slots": {
      "memory": "openbmb-clawxmemory"
    },
    "entries": {
      "openbmb-clawxmemory": {
        "enabled": true,
        "hooks": {
          "allowPromptInjection": true
        }
      }
    }
  }
}
```

Notes:

- This is a `kind: "memory"` plugin and should be assigned to `plugins.slots.memory`.
- `allowPromptInjection: true` must be enabled, or OpenClaw will block the memory injection performed during `before_prompt_build`.
- If port `39393` is already in use on your machine, explicitly set `plugins.entries.openbmb-clawxmemory.config.uiPort`.

## Development

Run these commands from this directory:

```bash
npm install
npm run build
npm run test
npm run debug:retrieve -- --query "project progress"
```

For local OpenClaw integration and debugging:

```bash
npm run relink
npm run reload
npm run uninstall
```

`npm run uninstall` restores native OpenClaw memory ownership and removes the managed plugin config/install records. If you need a fully clean reinstall after that, also remove the leftover extension directory that OpenClaw may keep on disk:

```bash
rm -rf ~/.openclaw/extensions/openbmb-clawxmemory
```

Before publishing to ClawHub, you can smoke test either installation path from this directory:

```bash
npm run uninstall
rm -rf ~/.openclaw/extensions/openbmb-clawxmemory
openclaw plugins install .
openclaw gateway restart
openclaw plugins inspect openbmb-clawxmemory --json
```

```bash
npm pack
openclaw plugins install ./openbmb-clawxmemory-*.tgz
openclaw gateway restart
openclaw plugins inspect openbmb-clawxmemory --json
```

## Publish to ClawHub

Run from this directory:

```bash
npx clawhub package publish . --family code-plugin
```

The `clawhub package publish` CLI version tested in this repository does not support `--dry-run`. To inspect the currently supported arguments first, run:

```bash
npx clawhub package publish --help
```

Repository-level installation, usage, and design docs are available in the root `README.md` and `docs/README_zh.md`.
